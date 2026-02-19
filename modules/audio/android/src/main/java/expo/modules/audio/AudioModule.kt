package expo.modules.audio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentLinkedQueue

class AudioModule : Module() {
  private var audioRecord: AudioRecord? = null
  private var audioTrack: AudioTrack? = null
  private var recordingJob: Job? = null
  private var playbackJob: Job? = null
  private var echoCanceler: AcousticEchoCanceler? = null
  private var noiseSuppressor: NoiseSuppressor? = null
  private var isMuted = false
  private var isRecording = false
  private val audioQueue = ConcurrentLinkedQueue<ByteArray>()
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  companion object {
    const val SAMPLE_RATE = 44100
    const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    const val BUFFER_DURATION_MS = 100 // 100ms chunks
  }

  override fun definition() = ModuleDefinition {
    Name("Audio")

    Events("onAudioInput", "onError")

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

  // MARK: - Recording

  private fun startRecordingInternal() {
    if (isRecording) return

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

      // Enable echo cancellation
      if (AcousticEchoCanceler.isAvailable()) {
        try {
          echoCanceler = AcousticEchoCanceler.create(record.audioSessionId)?.apply {
            enabled = true
          }
        } catch (_: Exception) {}
      }

      // Enable noise suppression
      if (NoiseSuppressor.isAvailable()) {
        try {
          noiseSuppressor = NoiseSuppressor.create(record.audioSessionId)?.apply {
            enabled = true
          }
        } catch (_: Exception) {}
      }

      record.startRecording()
      isRecording = true

      // Start recording loop
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
  }

  // MARK: - Playback

  private fun startPlaybackLoop() {
    playbackJob = scope.launch {
      while (isActive) {
        val audioData = audioQueue.poll()
        if (audioData != null) {
          playAudioChunk(audioData)
        } else {
          delay(10)
          if (audioQueue.isEmpty()) break
        }
      }
      playbackJob = null
    }
  }

  private fun playAudioChunk(data: ByteArray) {
    // Parse WAV if present, otherwise treat as raw PCM
    val pcmData: ByteArray
    var wavSampleRate = 24000 // Default Hume output
    var wavChannels = 1
    var wavBitsPerSample = 16

    if (data.size > 44 && data[0] == 'R'.code.toByte() && data[1] == 'I'.code.toByte() &&
        data[2] == 'F'.code.toByte() && data[3] == 'F'.code.toByte()) {
      // Parse WAV header
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

    val channelConfig = if (wavChannels == 1) {
      AudioFormat.CHANNEL_OUT_MONO
    } else {
      AudioFormat.CHANNEL_OUT_STEREO
    }
    val encoding = if (wavBitsPerSample == 16) {
      AudioFormat.ENCODING_PCM_16BIT
    } else {
      AudioFormat.ENCODING_PCM_8BIT
    }

    // Create or reuse AudioTrack
    val minBufSize = AudioTrack.getMinBufferSize(wavSampleRate, channelConfig, encoding)
    val trackBufSize = maxOf(minBufSize, pcmData.size)

    val track = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(encoding)
          .setSampleRate(wavSampleRate)
          .setChannelMask(channelConfig)
          .build()
      )
      .setBufferSizeInBytes(trackBufSize)
      .setTransferMode(AudioTrack.MODE_STATIC)
      .build()

    track.write(pcmData, 0, pcmData.size)
    track.play()

    // Wait for playback to complete
    val durationMs = (pcmData.size.toLong() * 1000) / (wavSampleRate * wavChannels * (wavBitsPerSample / 8))
    Thread.sleep(durationMs)

    track.stop()
    track.release()
  }

  private fun stopPlaybackInternal() {
    audioQueue.clear()
    playbackJob?.cancel()
    playbackJob = null
    audioTrack?.let {
      try {
        it.stop()
        it.release()
      } catch (_: Exception) {}
    }
    audioTrack = null
  }

  private fun cleanup() {
    stopRecordingInternal()
    stopPlaybackInternal()
    scope.cancel()
  }
}
