/**
 * VoiceAgentScreen Component
 * Chat-style voice conversation with Hume AI EVI
 *
 * UI: Accumulated chat messages (mello left, user right) with typing indicator
 * Audio: NativeAudio (mic) → HumeEVIService (WebSocket) → NativeAudio (speaker)
 * Echo prevention: AEC with shared session + AudioManager MODE_IN_COMMUNICATION
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import FadingScrollWrapper from '@/components/get-rolling/ScrollFadeEdges';

import { Buffer } from 'buffer';
import { HumeEVIService, EmotionScores } from '@/utils/humeService';
import MelloGradient from '@/components/common/MelloGradient';
import CrisisInlineWarning from './CrisisInlineWarning';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import { LIGHT_THEME } from '@/components/common/LightGradient';
import { detectCrisis, callCrisisLine } from '@/utils/crisisDetection';
import { fullscreenStore } from '@/utils/fullscreenStore';
import TranscriptIcon from './TranscriptIcon';

// Lazy-load NativeAudio
let NativeAudio: any = null;
try {
  NativeAudio = require('@/modules/audio').default;
} catch (e) {
  console.warn('[Mello] NativeAudio module not available — native prebuild required');
}

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

type CallState = 'idle' | 'connecting' | 'active' | 'ended';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const HUME_API_KEY = process.env.EXPO_PUBLIC_HUME_API_KEY || '';
const HUME_DEFAULT_CONFIG_ID = process.env.EXPO_PUBLIC_HUME_CONFIG_ID || '';

type VoiceOption = {
  id: string;
  label: string;
  subtitle: string;
  configId: string;
};

const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'expressive-girl',
    label: 'Expressive Girl',
    subtitle: 'English',
    configId: HUME_DEFAULT_CONFIG_ID,
  },
  {
    id: 'priya',
    label: 'Priya',
    subtitle: 'Hindi',
    configId: 'c23b7a0d-d006-48a4-b88b-c1516098202e',
  },
  {
    id: 'indian-actress',
    label: 'Indian Actress',
    subtitle: 'English, Indian accent',
    configId: '711166ca-e267-43ed-a8c0-b725164e48cf',
  },
];

// ═══════════════════════════════════════════════════
// DEV MODE — set to true to skip Hume and use fake transcript
// ═══════════════════════════════════════════════════
const DEV_MODE = false;

const DEV_CONVERSATION: Array<{ role: 'user' | 'assistant'; text: string; delay: number }> = [
  { role: 'assistant', text: 'Hi hello, I am mello, what\'s on your mind?', delay: 1500 },
  { role: 'user', text: 'hello mello i am raj. I am fine', delay: 4000 },
  { role: 'assistant', text: 'Oh really! Glad to hear that you are fine. What would you like to talk about today?', delay: 3000 },
  { role: 'user', text: 'I have been feeling stressed about work lately', delay: 5000 },
  { role: 'assistant', text: 'I hear you. Work stress can really weigh on us. Can you tell me more about what\'s been going on?', delay: 3500 },
  { role: 'user', text: 'too many deadlines and not enough time', delay: 4500 },
  { role: 'assistant', text: 'That sounds overwhelming. When everything piles up, it can feel like there\'s no breathing room. Have you been able to take any breaks?', delay: 3000 }
];

const DISTRESS_EMOTIONS = ['Distress', 'Sadness', 'Fear', 'Pain', 'Anxiety', 'Desperation'];
const DISTRESS_THRESHOLD = 0.6;

const GRADIENT_AMPLITUDE_THRESHOLD = 500;
const GRADIENT_SILENCE_TIMEOUT_MS = 1500;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getMaxAmplitude(base64Audio: string): number {
  try {
    const buf = Buffer.from(base64Audio, 'base64');
    const len = buf.length;
    if (len < 4) return 0;
    let maxAmp = 0;
    const step = 40;
    for (let i = 0; i < len - 1; i += step) {
      let sample = buf[i] | (buf[i + 1] << 8);
      if (sample > 32767) sample -= 65536;
      const abs = sample < 0 ? -sample : sample;
      if (abs > maxAmp) maxAmp = abs;
    }
    return maxAmp;
  } catch {
    return 0;
  }
}

let msgIdCounter = 0;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Memoized message item — only animates the latest new message
const ChatBubble = React.memo(({ item, isNew }: { item: ChatMessage; isNew: boolean }) => {
  const isUser = item.role === 'user';
  if (isUser) {
    return (
      <Animated.View
        entering={isNew ? FadeInDown.duration(550) : undefined}
        style={styles.userRow}
      >
        <View style={styles.userBubble}>
          <Text style={[styles.messageText, styles.userMessageText]}>
            {item.text}
          </Text>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      entering={isNew ? FadeInDown.duration(550) : undefined}
      style={styles.melloBubble}
    >
      <Text style={[styles.messageText, styles.melloMessageText]}>
        {item.text}
      </Text>
    </Animated.View>
  );
});

// Self-contained timer — owns its own state so ticks don't re-render parent/FlashList
const CallTimer = React.memo(({
  isActive,
  isUserSpeaking,
  isAssistantSpeaking,
}: {
  isActive: boolean;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
}) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive) { setDuration(0); return; }
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <View style={styles.timerSection}>
      <View style={styles.timerRow}>
        <Text style={styles.timerText}>{formatDuration(duration)}</Text>
        {isUserSpeaking && <View style={styles.listeningDot} />}
        {isAssistantSpeaking && !isUserSpeaking && <View style={styles.speakingDot} />}
      </View>
    </View>
  );
});

const chatKeyExtractor = (item: ChatMessage) => item.id;

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function VoiceAgentScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [showCrisisWarning, setShowCrisisWarning] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // Hume EVI state
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // Service ref
  const humeServiceRef = useRef<HumeEVIService | null>(null);
  const audioListenerRef = useRef<any>(null);
  const playbackCompleteListenerRef = useRef<any>(null);

  // Mutable refs
  const assistantSpeakingRef = useRef(false);
  const isMutedRef = useRef(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatedIdsRef = useRef<Set<string>>(new Set());

  // ── Gradient speaker ──
  const gradientSpeaker = useMemo(() => {
    if (callState !== 'active') return 'mello' as const;
    if (isUserSpeaking) return 'user' as const;
    return 'mello' as const;
  }, [callState, isUserSpeaking]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (showTranscript && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, showTranscript]);

  const handleCrisisConnect = useCallback(() => {
    callCrisisLine();
  }, []);

  // Memoized footer
  const listFooter = useMemo(() => (
    <>
      {isWaitingForResponse && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.melloBubble, styles.typingBubble]}
        >
          <TypingIndicator color="#f1b1f672" />
        </Animated.View>
      )}
      {showCrisisWarning && (
        <CrisisInlineWarning
          onConnect={handleCrisisConnect}
          onDismiss={() => setShowCrisisWarning(false)}
        />
      )}
    </>
  ), [isWaitingForResponse, showCrisisWarning, handleCrisisConnect]);

  // Memoized renderItem — tracks animated IDs via ref (no re-renders)
  const renderChatItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isNew = !animatedIdsRef.current.has(item.id);
    if (isNew) animatedIdsRef.current.add(item.id);
    return <ChatBubble item={item} isNew={isNew} />;
  }, []);

  // ═══════════════════════════════════════════════════
  // HUME EVI CALLBACKS
  // ═══════════════════════════════════════════════════

  const humeCallbacks = useMemo(() => ({
    onUserMessage: (text: string, emotions: EmotionScores) => {
      console.log('[Hume] user_message:', text);
      setIsUserSpeaking(false);
      setIsWaitingForResponse(true);

      // Add user message to chat
      const newId = `msg-${++msgIdCounter}`;
      setMessages((prev) => [...prev, { id: newId, role: 'user', text }]);

      // Crisis detection
      const hasCrisisKeyword = detectCrisis(text);
      const hasHighDistress = emotions.top3.some(
        (e) => DISTRESS_EMOTIONS.includes(e.name) && e.score > DISTRESS_THRESHOLD,
      );
      if (hasCrisisKeyword || hasHighDistress) {
        setShowCrisisWarning(true);
      }
    },

    onAssistantMessage: (text: string) => {
      console.log('[Hume] assistant_message:', text.substring(0, 80) + '...');
      assistantSpeakingRef.current = true;
      setIsUserSpeaking(false);
      setIsWaitingForResponse(false);
      setIsAssistantSpeaking(true);

      // Add assistant message to chat
      const newId = `msg-${++msgIdCounter}`;
      setMessages((prev) => [...prev, { id: newId, role: 'assistant', text }]);
    },

    onAudioOutput: async (base64Audio: string) => {
      if (!NativeAudio) return;
      try {
        await NativeAudio.enqueueAudio(base64Audio);
      } catch (err) {
        console.warn('[Hume] enqueueAudio error:', err);
      }
    },

    onUserInterruption: async () => {
      console.log('[Hume] user_interruption — stopping playback');
      if (NativeAudio) NativeAudio.stopPlayback().catch(() => { });
      assistantSpeakingRef.current = false;
      setIsAssistantSpeaking(false);
      setIsUserSpeaking(true);
    },

    onAssistantEnd: () => {
      console.log('[Hume] assistant_end');
    },

    onConnected: (chatId: string) => {
      console.log('[Hume] connected, chatId:', chatId);
      setCallState('active');
    },

    onDisconnected: () => {
      console.log('[Hume] disconnected');
      setCallState((prev) => (prev === 'active' ? 'ended' : prev));
    },

    onError: (error: string) => {
      console.error('[Hume] error:', error);
    },
  }), []);

  // ═══════════════════════════════════════════════════
  // CALL HANDLERS
  // ═══════════════════════════════════════════════════

  const devTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startDevConversation = useCallback(() => {
    console.log('[DEV] Starting fake conversation');
    setCallState('active');
    setShowTranscript(true);

    let elapsed = 500; // initial delay after "connecting"
    const timers: ReturnType<typeof setTimeout>[] = [];

    DEV_CONVERSATION.forEach((entry) => {
      const isAssistant = entry.role === 'assistant';

      // Show typing indicator before assistant messages
      if (isAssistant) {
        timers.push(setTimeout(() => {
          setIsWaitingForResponse(true);
        }, elapsed));
        elapsed += 1200; // typing indicator visible for 1.2s
      }

      // Show the message
      timers.push(setTimeout(() => {
        setIsWaitingForResponse(false);
        if (isAssistant) {
          assistantSpeakingRef.current = true;
          setIsAssistantSpeaking(true);
        } else {
          setIsUserSpeaking(false);
        }
        const newId = `msg-${++msgIdCounter}`;
        setMessages((prev) => [...prev, { id: newId, role: entry.role, text: entry.text }]);
      }, elapsed));

      // End assistant speaking state after a bit
      if (isAssistant) {
        timers.push(setTimeout(() => {
          assistantSpeakingRef.current = false;
          setIsAssistantSpeaking(false);
        }, elapsed + 1500));
      }

      elapsed += entry.delay;
    });

    devTimersRef.current = timers;
  }, []);

  const handleStartCall = useCallback(async () => {
    console.log(`[Mello] === Starting call with voice: ${selectedVoice.label} ===`);
    setCallState('connecting');
    setMessages([]);
    setShowCrisisWarning(false);
    setIsUserSpeaking(false);
    setIsWaitingForResponse(false);
    setShowTranscript(false);
    assistantSpeakingRef.current = false;
    msgIdCounter = 0;
    animatedIdsRef.current.clear();

    // ── DEV MODE: skip Hume, play fake conversation ──
    if (DEV_MODE) {
      setTimeout(() => startDevConversation(), 800);
      return;
    }

    // ── PRODUCTION: connect to Hume EVI ──
    if (!HUME_API_KEY || !selectedVoice.configId) {
      console.error('[Mello] Hume API key or config ID not set');
      return;
    }

    try {
      if (NativeAudio) {
        const granted = await NativeAudio.getPermissions();
        if (!granted) { setCallState('idle'); return; }
      }

      const service = new HumeEVIService(
        HUME_API_KEY,
        selectedVoice.configId,
        humeCallbacks,
      );
      humeServiceRef.current = service;
      await service.connect();

      if (NativeAudio) {
        let audioChunkCount = 0;

        audioListenerRef.current = NativeAudio.addListener(
          'onAudioInput',
          ({ base64EncodedAudio }: { base64EncodedAudio: string }) => {
            service.sendAudio(base64EncodedAudio);
            audioChunkCount++;
            if (audioChunkCount % 50 === 1) {
              console.log(`[Mello] Sent ${audioChunkCount} audio chunks`);
            }

            if (!assistantSpeakingRef.current) {
              const amplitude = getMaxAmplitude(base64EncodedAudio);
              if (amplitude > GRADIENT_AMPLITUDE_THRESHOLD) {
                setIsUserSpeaking(true);
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = setTimeout(() => {
                  setIsUserSpeaking(false);
                }, GRADIENT_SILENCE_TIMEOUT_MS);
              }
            }
          },
        );

        playbackCompleteListenerRef.current = NativeAudio.addListener(
          'onPlaybackComplete',
          () => {
            console.log('[Audio] onPlaybackComplete');
            assistantSpeakingRef.current = false;
            setIsAssistantSpeaking(false);
          },
        );

        await NativeAudio.startRecording();
      }

      console.log('[Mello] === Call setup complete ===');
    } catch (err) {
      console.error('[Mello] Failed to start call:', err);
      setCallState('idle');
    }
  }, [humeCallbacks, selectedVoice, startDevConversation]);

  const handleEndCall = useCallback(async () => {
    console.log('[Mello] === Ending call ===');

    // Clear dev timers
    devTimersRef.current.forEach(clearTimeout);
    devTimersRef.current = [];

    if (!DEV_MODE && NativeAudio) {
      try {
        await NativeAudio.stopPlayback();
        await NativeAudio.unmute();
        await NativeAudio.stopRecording();
      } catch (err) {
        console.warn('[Mello] Error stopping audio:', err);
      }
    }

    audioListenerRef.current?.remove();
    audioListenerRef.current = null;
    playbackCompleteListenerRef.current?.remove();
    playbackCompleteListenerRef.current = null;
    humeServiceRef.current?.disconnect();
    humeServiceRef.current = null;

    setCallState('ended');
    setIsAssistantSpeaking(false);
    setIsUserSpeaking(false);
    setIsWaitingForResponse(false);
    setIsFullscreen(false);
    assistantSpeakingRef.current = false;
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
  }, []);

  const handleNewCall = useCallback(() => {
    setCallState('idle');
    setMessages([]);
    setShowCrisisWarning(false);
    setShowTranscript(false);
    setIsFullscreen(false);
  }, []);

  const handleToggleMute = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    if (NativeAudio) {
      try {
        if (newMuted) await NativeAudio.mute();
        else await NativeAudio.unmute();
      } catch (err) {
        console.warn('[Mello] Mute toggle error:', err);
      }
    }
  }, [isMuted]);

  const handleToggleTranscript = useCallback(() => {
    setShowTranscript((prev) => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Sync local fullscreen state to the external store via useEffect.
  // This avoids "Cannot update component X while rendering Y" errors
  // that happened when fullscreenStore.set() was called inside setState.
  useEffect(() => {
    fullscreenStore.set(isFullscreen);
  }, [isFullscreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fullscreenStore.set(false);
      devTimersRef.current.forEach(clearTimeout);
      audioListenerRef.current?.remove();
      playbackCompleteListenerRef.current?.remove();
      humeServiceRef.current?.disconnect();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (NativeAudio) {
        NativeAudio.stopPlayback().catch(() => { });
        NativeAudio.stopRecording().catch(() => { });
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  // Avatar placeholder (when transcript is hidden or idle)
  const renderAvatarPlaceholder = () => (
    <View style={styles.avatarContainer}>
      {callState === 'active' && isAssistantSpeaking && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.speakingIndicatorRow}>
          <TypingIndicator color="rgb(0, 0, 0)" />
        </Animated.View>
      )}
      <View style={styles.avatarCircle}>
        <Ionicons name="sparkles" size={40} color={LIGHT_THEME.accent} />
      </View>
      {callState === 'active' && (
        <Text style={styles.avatarStatusText}>
          {isAssistantSpeaking ? 'mello is speaking...' :
            isUserSpeaking ? 'listening...' :
              isMuted ? 'muted' : 'listening...'}
        </Text>
      )}
      {callState === 'connecting' && (
        <Text style={styles.avatarStatusText}>connecting...</Text>
      )}
      {callState === 'ended' && (
        <Text style={styles.avatarStatusText}>session ended</Text>
      )}
    </View>
  );

  // Idle screen — voice selector
  const renderIdleScreen = () => (
    <View style={styles.idleContainer}>
      <View style={styles.avatarCircle}>
        <Ionicons name="sparkles" size={40} color={LIGHT_THEME.accent} />
      </View>
      <Text style={styles.idleTitle}>talk to mello</Text>
      <View style={styles.voiceSelector}>
        <Text style={styles.voiceSelectorLabel}>voice</Text>
        <View style={styles.voiceChips}>
          {VOICE_OPTIONS.map((voice) => (
            <Pressable
              key={voice.id}
              style={[
                styles.voiceChip,
                selectedVoice.id === voice.id && styles.voiceChipSelected,
              ]}
              onPress={() => setSelectedVoice(voice)}
            >
              <Text
                style={[
                  styles.voiceChipLabel,
                  selectedVoice.id === voice.id && styles.voiceChipLabelSelected,
                ]}
              >
                {voice.label}
              </Text>
              <Text
                style={[
                  styles.voiceChipSubtitle,
                  selectedVoice.id === voice.id && styles.voiceChipSubtitleSelected,
                ]}
              >
                {voice.subtitle}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Animated gradient background */}
      <MelloGradient speaker={gradientSpeaker} />

      {/* Info button — always visible */}
      <Pressable style={styles.infoButton}>
        <Ionicons name="information-circle-outline" size={28} color="#9999a8" />
      </Pressable>

      {/* Timer — self-contained, ticks don't re-render chat */}
      {callState === 'active' && (
        <CallTimer
          isActive={callState === 'active'}
          isUserSpeaking={isUserSpeaking}
          isAssistantSpeaking={isAssistantSpeaking}
        />
      )}

      {/* Content */}
      <View style={styles.contentSection}>
        {callState === 'idle' && renderIdleScreen()}
        {callState !== 'idle' && showTranscript && (
          <FadingScrollWrapper topFadeHeight={40} bottomFadeHeight={45}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderChatItem}
              keyExtractor={chatKeyExtractor}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={listFooter}
              removeClippedSubviews={false}
            />
          </FadingScrollWrapper>
        )}
        {callState !== 'idle' && !showTranscript && renderAvatarPlaceholder()}
      </View>

      {/* Controls */}
      <View style={[styles.controlsBar, { paddingBottom: 24 }]}>
        {callState === 'idle' && (
          <Pressable style={styles.startPill} onPress={handleStartCall}>
            <Ionicons name="mic" size={22} color="#FFFFFF" />
            <Text style={styles.startPillText}>Start</Text>
          </Pressable>
        )}

        {callState === 'connecting' && (
          <Pressable style={styles.connectingPill} onPress={handleEndCall}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.connectingPillText}>Cancel</Text>
          </Pressable>
        )}

        {callState === 'active' && (
          <View style={styles.controlBar}>
            {/* Mute */}
            <Pressable
              style={[styles.controlIcon, isMuted && styles.controlIconActive]}
              onPress={handleToggleMute}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={20}
                color="#9999a8"
              />
            </Pressable>

            {/* Transcript toggle */}
            <Pressable
              style={[styles.controlIcon, showTranscript && styles.controlIconActive]}
              onPress={handleToggleTranscript}
            >
              <TranscriptIcon size={25} color="#9999a8" />
            </Pressable>

            {/* Fullscreen toggle */}
            <Pressable
              style={[styles.controlIcon, isFullscreen && styles.controlIconActive]}
              onPress={handleToggleFullscreen}
            >
              <Ionicons
                name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                size={20}
                color="#9999a8"
              />
            </Pressable>

            {/* End call pill */}
            <Pressable style={styles.endPill} onPress={handleEndCall}>
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.endPillText}>End</Text>
            </Pressable>
          </View>
        )}

        {callState === 'ended' && (
          <Pressable style={styles.startPill} onPress={handleNewCall}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.startPillText}>New session</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  infoButton: {
    position: 'absolute',
    top: 38,
    right: 8,
    padding: 8,
    zIndex: 10,
  },

  // Timer
  timerSection: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53E3E',
  },
  speakingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#b9a6ff',
  },

  // Content
  contentSection: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // ── Chat transcript ──
  chatScrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 0,
    gap: 15,
  },
  melloBubble: {
    alignSelf: 'flex-start',
    maxWidth: SCREEN_WIDTH * 0.8,
    paddingVertical: 5,
    paddingHorizontal: 0,
    borderRadius: 22,
  },
  userRow: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 25,
    
  },
  messageText: {
    fontSize: 18,
    fontFamily: 'Outfit-Regular',
    lineHeight: 22,
  },
  melloMessageText: {
    color: '#3e3e45',
    fontFamily: 'Outfit-Regular',
  },
  userMessageText: {
    color: '#747480',
  },
  typingBubble: {
    paddingVertical: 4,
  },

  // ── Avatar placeholder ──
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(185, 166, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStatusText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  speakingIndicatorRow: {
    marginBottom: 8,
  },

  // ── Idle screen ──
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  idleTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
  },
  voiceSelector: {
    alignItems: 'center',
    gap: 12,
  },
  voiceSelectorLabel: {
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
    textTransform: 'lowercase',
    letterSpacing: 1,
  },
  voiceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  voiceChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(185, 166, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(185, 166, 255, 0.15)',
    alignItems: 'center',
    minWidth: 100,
  },
  voiceChipSelected: {
    backgroundColor: 'rgba(185, 166, 255, 0.2)',
    borderColor: LIGHT_THEME.accent,
  },
  voiceChipLabel: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
  },
  voiceChipLabelSelected: {
    color: LIGHT_THEME.accent,
  },
  voiceChipSubtitle: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
    marginTop: 2,
  },
  voiceChipSubtitleSelected: {
    color: LIGHT_THEME.accent,
  },

  // ── Controls ──
  controlsBar: {
    alignItems: 'center',
    gap: 16,
    
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#9999a85f',
    borderRadius: 99,
    padding: 8,
    gap: 8,
  },
  controlIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIconActive: {
    backgroundColor: '#ffffff',
  },
  endPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(229, 62, 62, 0.85)',
    gap: 6,
    marginLeft: 2,
  },
  endPillText: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  startPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 99,
    backgroundColor: 'rgba(185, 166, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(185, 166, 255, 0.35)',
    gap: 10,
  },
  startPillText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  connectingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  connectingPillText: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
