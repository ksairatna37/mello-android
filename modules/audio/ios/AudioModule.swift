import ExpoModulesCore
import AVFoundation

public class AudioModule: Module {
  private var audioEngine: AVAudioEngine?
  private var playerNode: AVAudioPlayerNode?
  private var mixerNode: AVAudioMixerNode?
  private var isMuted = false
  private var isRecording = false
  private var audioQueue: [Data] = []
  private var isPlaying = false
  private let sampleRate: Double = 48000.0
  private let bufferSize: AVAudioFrameCount = 960 // 20ms at 48kHz

  public func definition() -> ModuleDefinition {
    Name("Audio")

    Events("onAudioInput", "onError")

    AsyncFunction("getPermissions") { () -> Bool in
      return await self.requestMicrophonePermission()
    }

    AsyncFunction("startRecording") {
      try self.setupAndStartRecording()
    }

    AsyncFunction("stopRecording") {
      self.stopRecordingInternal()
    }

    AsyncFunction("enqueueAudio") { (base64EncodedAudio: String) in
      guard let audioData = Data(base64Encoded: base64EncodedAudio) else {
        self.sendEvent("onError", ["message": "Invalid base64 audio data"])
        return
      }
      self.audioQueue.append(audioData)
      if !self.isPlaying {
        self.playNextInQueue()
      }
    }

    AsyncFunction("stopPlayback") {
      self.stopPlaybackInternal()
    }

    AsyncFunction("mute") {
      self.isMuted = true
    }

    AsyncFunction("unmute") {
      self.isMuted = false
    }

    AsyncFunction("getMicrophoneMode") { () -> String in
      if #available(iOS 15.0, *) {
        let currentRoute = AVAudioSession.sharedInstance().currentRoute
        for input in currentRoute.inputs {
          if let dataSources = input.dataSources,
             let selected = input.selectedDataSource {
            return selected.dataSourceName
          }
        }
      }
      return "Standard"
    }
  }

  // MARK: - Permissions

  private func requestMicrophonePermission() async -> Bool {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setActive(true)
    } catch {
      sendEvent("onError", ["message": "Failed to configure audio session: \(error.localizedDescription)"])
      return false
    }

    if #available(iOS 17.0, *) {
      return await AVAudioApplication.requestRecordPermission()
    } else {
      return await withCheckedContinuation { continuation in
        session.requestRecordPermission { granted in
          continuation.resume(returning: granted)
        }
      }
    }
  }

  // MARK: - Recording

  private func setupAndStartRecording() throws {
    guard !isRecording else { return }

    let engine = AVAudioEngine()
    let inputNode = engine.inputNode

    // Configure for voice chat with echo cancellation
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setPreferredSampleRate(sampleRate)
      try session.setPreferredIOBufferDuration(0.02) // 20ms buffer
      try session.setActive(true)
    } catch {
      sendEvent("onError", ["message": "Audio session setup failed: \(error.localizedDescription)"])
      throw error
    }

    // Setup player node for output
    let player = AVAudioPlayerNode()
    engine.attach(player)

    let outputFormat = engine.outputNode.outputFormat(forBus: 0)
    engine.connect(player, to: engine.mainMixerNode, format: outputFormat)

    // Setup input tap for recording
    let inputFormat = inputNode.outputFormat(forBus: 0)
    let recordFormat = AVAudioFormat(
      commonFormat: .pcmFormatInt16,
      sampleRate: sampleRate,
      channels: 1,
      interleaved: true
    )!

    // Install tap on input node
    inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
      guard let self = self, !self.isMuted else { return }

      // Convert to target format if needed
      let pcmBuffer: AVAudioPCMBuffer
      if inputFormat.sampleRate != self.sampleRate || inputFormat.channelCount != 1 {
        guard let converter = AVAudioConverter(from: inputFormat, to: recordFormat),
              let convertedBuffer = AVAudioPCMBuffer(pcmFormat: recordFormat, frameCapacity: self.bufferSize) else {
          return
        }
        var error: NSError?
        converter.convert(to: convertedBuffer, error: &error) { _, outStatus in
          outStatus.pointee = .haveData
          return buffer
        }
        if error != nil { return }
        pcmBuffer = convertedBuffer
      } else {
        pcmBuffer = buffer
      }

      // Convert to base64
      guard let channelData = pcmBuffer.int16ChannelData else { return }
      let frameLength = Int(pcmBuffer.frameLength)
      let data = Data(bytes: channelData[0], count: frameLength * 2)
      let base64String = data.base64EncodedString()

      self.sendEvent("onAudioInput", ["base64EncodedAudio": base64String])
    }

    try engine.start()

    self.audioEngine = engine
    self.playerNode = player
    self.isRecording = true
  }

  private func stopRecordingInternal() {
    guard isRecording else { return }
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine?.stop()
    playerNode?.stop()
    audioEngine = nil
    playerNode = nil
    isRecording = false
  }

  // MARK: - Playback

  private func playNextInQueue() {
    guard !audioQueue.isEmpty else {
      isPlaying = false
      return
    }

    isPlaying = true
    let audioData = audioQueue.removeFirst()

    guard let engine = audioEngine, let player = playerNode else {
      isPlaying = false
      return
    }

    // Parse WAV data - skip 44-byte WAV header if present
    let pcmData: Data
    if audioData.count > 44 && audioData[0...3] == Data([0x52, 0x49, 0x46, 0x46]) {
      pcmData = audioData.subdata(in: 44..<audioData.count)
    } else {
      pcmData = audioData
    }

    // Create PCM buffer from raw data
    let outputFormat = AVAudioFormat(
      commonFormat: .pcmFormatInt16,
      sampleRate: 24000, // Hume outputs 24kHz
      channels: 1,
      interleaved: true
    )!

    let frameCount = UInt32(pcmData.count / 2) // 16-bit = 2 bytes per frame
    guard let buffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCount) else {
      playNextInQueue()
      return
    }
    buffer.frameLength = frameCount

    pcmData.withUnsafeBytes { rawPtr in
      if let src = rawPtr.baseAddress {
        memcpy(buffer.int16ChannelData![0], src, pcmData.count)
      }
    }

    // Convert to output format if sample rates differ
    let engineOutputFormat = engine.outputNode.outputFormat(forBus: 0)
    if outputFormat.sampleRate != engineOutputFormat.sampleRate {
      guard let converter = AVAudioConverter(from: outputFormat, to: engineOutputFormat),
            let convertedBuffer = AVAudioPCMBuffer(
              pcmFormat: engineOutputFormat,
              frameCapacity: AVAudioFrameCount(Double(frameCount) * engineOutputFormat.sampleRate / outputFormat.sampleRate) + 1
            ) else {
        playNextInQueue()
        return
      }
      var error: NSError?
      converter.convert(to: convertedBuffer, error: &error) { _, outStatus in
        outStatus.pointee = .haveData
        return buffer
      }
      if error == nil {
        player.scheduleBuffer(convertedBuffer) { [weak self] in
          DispatchQueue.main.async {
            self?.playNextInQueue()
          }
        }
      } else {
        playNextInQueue()
        return
      }
    } else {
      player.scheduleBuffer(buffer) { [weak self] in
        DispatchQueue.main.async {
          self?.playNextInQueue()
        }
      }
    }

    if !player.isPlaying {
      player.play()
    }
  }

  private func stopPlaybackInternal() {
    audioQueue.removeAll()
    playerNode?.stop()
    isPlaying = false
  }
}
