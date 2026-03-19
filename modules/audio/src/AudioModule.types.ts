export type MicrophoneMode = 'N/A' | 'Standard' | 'Voice Isolation' | 'Wide Spectrum';

export type AudioModuleEvents = {
  onAudioInput: (params: AudioEventPayload) => void;
  onError: (params: { message: string }) => void;
  onPlaybackComplete: () => void;
};

export type AudioEventPayload = {
  base64EncodedAudio: string;
};
