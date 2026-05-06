package com.selfmind.audio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentLinkedQueue

class MelloAudioModule : Module() {
  private var audioRecord: AudioRecord? = null
  private var audioTrack: AudioTrack? = null
  private var recordingJob: Job? = null
  private var playbackJob: Job? = null
  private var echoCanceler: AcousticEchoCanceler? = null
  private var noiseSuppressor: NoiseSuppressor? = null
  private var audioManager: AudioManager? = null
  private var isMuted = false
  private var isRecording = false
  private val audioQueue = ConcurrentLinkedQueue<ByteArray>()
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  // Track current playback format to reuse AudioTrack when format is unchanged
  private var playbackSampleRate = 0
  private var playbackChannels = 0
  private var playbackEncoding = 0

  companion object {
    private const val TAG = "AudioModule"
    const val SAMPLE_RATE = 44100
    const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    const val BUFFER_DURATION_MS = 100 // 100ms chunks
  }

  override fun definition() = ModuleDefinition {
    Name("Audio")

    Events("onAudioInput", "onError", "onPlaybackComplete")

    AsyncFunction("getPermissions") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.resolve(false)
        return@AsyncFunction
      }
      val granted = ContextCompat.checkSelfPermission(
        context, Manifest.permission.RECORD_AUDIO
      ) == PackageManager.PERMISSION_GRANTED
      promise.resolve(granted)
    }

    AsyncFunction("startRecording") { promise: Promise ->
      try {
        startRecordingInternal()
        promise.resolve(null)
      } catch (e: Exception) {
        sendEvent("onError", mapOf("message" to "Failed to start recording: ${e.message}"))
        promise.reject("ERR_RECORDING", e.message, e)
      }
    }

    AsyncFunction("stopRecording") { promise: Promise ->
      stopRecordingInternal()
      promise.resolve(null)
    }

    AsyncFunction("enqueueAudio") { base64EncodedAudio: String, promise: Promise ->
      try {
        val audioData = Base64.decode(base64EncodedAudio, Base64.NO_WRAP)
        audioQueue.add(audioData)
        if (playbackJob == null || playbackJob?.isActive != true) {
          startPlaybackLoop()
        }
        promise.resolve(null)
      } catch (e: Exception) {
        sendEvent("onError", mapOf("message" to "Failed to enqueue audio: ${e.message}"))
        promise.reject("ERR_PLAYBACK", e.message, e)
      }
    }

    AsyncFunction("stopPlayback") { promise: Promise ->
      stopPlaybackInternal()
      promise.resolve(null)
    }

    AsyncFunction("mute") { promise: Promise ->
      isMuted = true
      promise.resolve(null)
    }

    AsyncFunction("unmute") { promise: Promise ->
      isMuted = false
      promise.resolve(null)
    }

    AsyncFunction("getMicrophoneMode") { promise: Promise ->
      promise.resolve("Standard")
    }

    OnDestroy {
      cleanup()
    }
  }

  // ═══════════════════════════════════════════════════
  // AUDIO MANAGER — voice communication mode + loudspeaker routing
  // ═══════════════════════════════════════════════════

  private fun configureAudioManager() {
    val context = appContext.reactContext ?: return
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audioManager = am

    // Activate voice communication path — required for AEC to work
    am.mode = AudioManager.MODE_IN_COMMUNICATION
    Log.d(TAG, "AudioManager mode set to MODE_IN_COMMUNICATION")

    // Route to LOUDSPEAKER (not earpiece)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val speaker = am.availableCommunicationDevices
        .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
      if (speaker != null) {
        val success = am.setCommunicationDevice(speaker)
        Log.d(TAG, "setCommunicationDevice(BUILTIN_SPEAKER) = $success")
      } else {
        Log.w(TAG, "No BUILTIN_SPEAKER found in availableCommunicationDevices")
      }
    } else {
      @Suppress("DEPRECATION")
      am.isSpeakerphoneOn = true
      Log.d(TAG, "setSpeakerphoneOn(true) [legacy API]")
    }
  }

  private fun resetAudioManager() {
    audioManager?.let { am ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.clearCommunicationDevice()
      } else {
        @Suppress("DEPRECATION")
        am.isSpeakerphoneOn = false
      }
      am.mode = AudioManager.MODE_NORMAL
      Log.d(TAG, "AudioManager reset to MODE_NORMAL")
    }
    audioManager = null
  }

  // ═══════════════════════════════════════════════════
  // RECORDING
  // ═══════════════════════════════════════════════════

  private fun startRecordingInternal() {
    if (isRecording) return

    // Configure AudioManager BEFORE creating AudioRecord
    configureAudioManager()

    val bufferSize = (SAMPLE_RATE * 2 * BUFFER_DURATION_MS / 1000).coerceAtLeast(
      AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
    )

    audioRecord = AudioRecord(
      MediaRecorder.AudioSource.VOICE_COMMUNICATION,
      SAMPLE_RATE,
      CHANNEL_CONFIG,
      AUDIO_FORMAT,
      bufferSize
    ).also { record ->
      if (record.state != AudioRecord.STATE_INITIALIZED) {
        throw RuntimeException("AudioRecord failed to initialize")
      }

      Log.d(TAG, "AudioRecord created, sessionId=${record.audioSessionId}")

      // Enable hardware echo cancellation (best-effort)
      if (AcousticEchoCanceler.isAvailable()) {
        try {
          echoCanceler = AcousticEchoCanceler.create(record.audioSessionId)?.apply {
            enabled = true
            Log.d(TAG, "AcousticEchoCanceler enabled, sessionId=${record.audioSessionId}")
          }
        } catch (_: Exception) {}
      }

      // Enable noise suppression
      if (NoiseSuppressor.isAvailable()) {
        try {
          noiseSuppressor = NoiseSuppressor.create(record.audioSessionId)?.apply {
            enabled = true
            Log.d(TAG, "NoiseSuppressor enabled")
          }
        } catch (_: Exception) {}
      }

      record.startRecording()
      isRecording = true

      recordingJob = scope.launch {
        val buffer = ByteArray(bufferSize)
        while (isActive && isRecording) {
          val bytesRead = record.read(buffer, 0, bufferSize)
          if (bytesRead > 0 && !isMuted) {
            val audioData = buffer.copyOf(bytesRead)
            val base64 = Base64.encodeToString(audioData, Base64.NO_WRAP)
            sendEvent("onAudioInput", mapOf("base64EncodedAudio" to base64))
          }
        }
      }
    }
  }

  private fun stopRecordingInternal() {
    isRecording = false
    recordingJob?.cancel()
    recordingJob = null

    audioRecord?.let {
      try {
        if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
          it.stop()
        }
        it.release()
      } catch (_: Exception) {}
    }
    audioRecord = null

    echoCanceler?.release()
    echoCanceler = null
    noiseSuppressor?.release()
    noiseSuppressor = null

    resetAudioManager()
  }

  // ═══════════════════════════════════════════════════
  // PLAYBACK — persistent AudioTrack with shared AEC session
  // ═══════════════════════════════════════════════════

  /**
   * Creates or reuses a persistent AudioTrack.
   * Critical for AEC: shares audioSessionId with AudioRecord so the echo
   * canceller can correlate playback (reference) with mic capture.
   */
  private fun ensureAudioTrack(sampleRate: Int, channels: Int, encoding: Int) {
    // Reuse existing track if format matches
    if (audioTrack != null &&
        playbackSampleRate == sampleRate &&
        playbackChannels == channels &&
        playbackEncoding == encoding) {
      return
    }

    // Release old track if format changed
    audioTrack?.let {
      try { it.stop() } catch (_: Exception) {}
      it.release()
    }

    playbackSampleRate = sampleRate
    playbackChannels = channels
    playbackEncoding = encoding

    val channelConfig = if (channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
    val minBufSize = AudioTrack.getMinBufferSize(sampleRate, channelConfig, encoding)
    val bufSize = minBufSize * 4 // 4x for MODE_STREAM headroom

    // Share session ID with AudioRecord — this is what makes AEC work
    val sessionId = audioRecord?.audioSessionId ?: AudioManager.AUDIO_SESSION_ID_GENERATE

    audioTrack = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(encoding)
          .setSampleRate(sampleRate)
          .setChannelMask(channelConfig)
          .build()
      )
      .setBufferSizeInBytes(bufSize)
      .setTransferMode(AudioTrack.MODE_STREAM)
      .setSessionId(sessionId)
      .build()

    Log.d(TAG, "AudioTrack created: ${sampleRate}Hz, sessionId=$sessionId, MODE_STREAM, VOICE_COMMUNICATION")
  }

  private fun startPlaybackLoop() {
    playbackJob = scope.launch {
      var emptyPollCount = 0
      while (isActive) {
        val audioData = audioQueue.poll()
        if (audioData != null) {
          emptyPollCount = 0
          writeAudioChunk(audioData)
        } else {
          emptyPollCount++
          delay(50) // 50ms between empty polls
          if (emptyPollCount >= 10) break // 500ms of empty queue = playback done
        }
      }

      // Stop the track to flush any remaining buffered audio
      audioTrack?.let { track ->
        if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
          try { track.stop() } catch (_: Exception) {}
        }
      }

      playbackJob = null
      Log.d(TAG, "Playback complete — firing onPlaybackComplete")
      sendEvent("onPlaybackComplete", emptyMap<String, Any>())
    }
  }

  /**
   * Writes PCM audio to the persistent AudioTrack (MODE_STREAM).
   * No Thread.sleep — write() blocks naturally when the buffer is full.
   */
  private fun writeAudioChunk(data: ByteArray) {
    val pcmData: ByteArray
    var wavSampleRate = 24000
    var wavChannels = 1
    var wavBitsPerSample = 16

    // Parse WAV header if present
    if (data.size > 44 && data[0] == 'R'.code.toByte() && data[1] == 'I'.code.toByte() &&
        data[2] == 'F'.code.toByte() && data[3] == 'F'.code.toByte()) {
      val bb = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
      bb.position(22)
      wavChannels = bb.short.toInt()
      wavSampleRate = bb.int
      bb.position(34)
      wavBitsPerSample = bb.short.toInt()
      pcmData = data.copyOfRange(44, data.size)
    } else {
      pcmData = data
    }

    val encoding = if (wavBitsPerSample == 16) AudioFormat.ENCODING_PCM_16BIT else AudioFormat.ENCODING_PCM_8BIT

    // Create or reuse persistent AudioTrack with shared AEC session
    ensureAudioTrack(wavSampleRate, wavChannels, encoding)

    val track = audioTrack ?: return

    // Start playing if not already
    if (track.playState != AudioTrack.PLAYSTATE_PLAYING) {
      track.play()
    }

    // Write PCM data — blocks when buffer is full (natural flow control)
    var offset = 0
    while (offset < pcmData.size) {
      val written = track.write(pcmData, offset, pcmData.size - offset)
      if (written > 0) {
        offset += written
      } else {
        break // Error or track stopped
      }
    }
  }

  private fun stopPlaybackInternal() {
    audioQueue.clear()
    playbackJob?.cancel()
    playbackJob = null
    audioTrack?.let {
      try {
        if (it.playState == AudioTrack.PLAYSTATE_PLAYING) {
          it.pause()
          it.flush() // Immediate silence on interrupt
        }
        it.stop()
        it.release()
      } catch (_: Exception) {}
    }
    audioTrack = null
    playbackSampleRate = 0
    playbackChannels = 0
    playbackEncoding = 0
  }

  private fun cleanup() {
    stopRecordingInternal()
    stopPlaybackInternal()
    resetAudioManager()
    scope.cancel()
  }
}
