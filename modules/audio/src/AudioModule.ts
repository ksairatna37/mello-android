import { requireNativeModule, EventEmitter } from 'expo-modules-core';
import type { AudioModuleEvents, MicrophoneMode } from './AudioModule.types';

const nativeModule = requireNativeModule('Audio');
const emitter = new EventEmitter(nativeModule as any);

type Subscription = { remove: () => void };

const AudioModule = {
  async getPermissions(): Promise<boolean> {
    return nativeModule.getPermissions();
  },

  async startRecording(): Promise<void> {
    return nativeModule.startRecording();
  },

  async stopRecording(): Promise<void> {
    return nativeModule.stopRecording();
  },

  async enqueueAudio(base64EncodedAudio: string): Promise<void> {
    return nativeModule.enqueueAudio(base64EncodedAudio);
  },

  async stopPlayback(): Promise<void> {
    return nativeModule.stopPlayback();
  },

  async mute(): Promise<void> {
    return nativeModule.mute();
  },

  async unmute(): Promise<void> {
    return nativeModule.unmute();
  },

  async getMicrophoneMode(): Promise<MicrophoneMode> {
    return nativeModule.getMicrophoneMode();
  },

  addListener<K extends keyof AudioModuleEvents>(
    eventName: K,
    listener: AudioModuleEvents[K],
  ): Subscription {
    return emitter.addListener(eventName as string, listener as any);
  },
};

export default AudioModule;
