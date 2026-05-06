/**
 * VoiceAgentScreen Component
 * Chat-style voice conversation with Hume AI EVI
 *
 * UI: Accumulated chat messages (mello left, user right) with typing indicator
 * Audio: NativeAudio (mic) → HumeEVIService (WebSocket) → NativeAudio (speaker)
 * Echo prevention: AEC with shared session + AudioManager MODE_IN_COMMUNICATION
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import FadingScrollWrapper from '@/components/get-rolling/ScrollFadeEdges';

import { Buffer } from 'buffer';
import { Audio } from 'expo-av';
import { HumeEVIService, EmotionScores } from '@/utils/humeService';
import MelloGradient from '@/components/common/MelloGradient';
import CrisisInlineWarning from './CrisisInlineWarning';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import { LIGHT_THEME } from '@/components/common/LightGradient';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import SelfMindOrb from '@/components/common/SelfMindOrb';
import { detectCrisis, callCrisisLine } from '@/utils/crisisDetection';
import { fullscreenStore } from '@/utils/fullscreenStore';
import { sidebarStore } from '@/utils/sidebarStore';
import { getSession } from '@/services/auth';
import { generateChatTitle } from '@/services/chat/bedrockService';
import {
  getVoiceSessionContext,
  startVoiceSession,
  updateHumeIds,
  updateVoiceTranscript,
  finalizeVoiceSession,
  type VoiceTranscriptEntry,
} from '@/services/chat/voiceChatService';
import { supabase } from '@/lib/supabase';
import TranscriptIcon from './TranscriptIcon';
import HindiVoiceScreen from './HindiVoiceScreen';
import InterventionIndicator from './InterventionIndicator';
import VoiceInfoSheet from './VoiceInfoSheet';
import {
  detectIntervention,
  getInitialInterventionDetectorState,
  isHighPriorityIntervention,
  type InterventionDecision,
  type InterventionDetectorState,
} from '@/utils/interventions';

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

import { ENV } from '@/config/env';

const HUME_API_KEY = ENV.humeApiKey;
const HUME_DEFAULT_CONFIG_ID = ENV.humeConfigId;

// Language options: English (Hume) or Hindi (LiveKit + Sarvam)
type VoiceLanguage = 'english' | 'hindi';

// ═══════════════════════════════════════════════════
// INVESTOR DEMO MODE — set to false to re-enable Hindi
// ═══════════════════════════════════════════════════
const DISABLE_HINDI_FOR_DEMO = false;

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

function getVoiceGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Ready to talk\nthis morning?';
  if (h >= 12 && h < 17) return "What's on your\nmind today?";
  if (h >= 17 && h < 21) return 'Ready to talk\nthis evening?';
  return 'Ready to talk\ntonight?';
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
// SelfMind ACTIVE SESSION HELPERS
// ═══════════════════════════════════════════════════

/**
 * SessionTimer — owns its own duration so the parent doesn't re-render
 * every second. Renders "SESSION · MM:SS" inline.
 */
const SessionTimer = React.memo(({ isActive }: { isActive: boolean }) => {
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    if (!isActive) { setDuration(0); return; }
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);
  return (
    <Text style={inkStyles.sessionLabel}>
      SESSION · {formatDuration(duration)}
    </Text>
  );
});

/**
 * PulseRing — concentric ring around the orb that breathes opacity +
 * scale. Three rings staggered by `index` produce the layered pulse
 * shown in MBVoiceActive. Only animates while `active` is true.
 */
const PulseRing = React.memo(({
  index,
  baseSize,
  active,
}: {
  index: number;
  baseSize: number;
  active: boolean;
}) => {
  const opacity = useSharedValue(0.3);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 0;
      scale.value = 1;
      return;
    }
    opacity.value = withDelay(
      index * 300,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    scale.value = withDelay(
      index * 300,
      withRepeat(
        withSequence(
          withTiming(1.25, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [active, index, opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const size = baseSize - index * 40;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        inkStyles.pulseRing,
        { width: size, height: size, borderRadius: size / 2 },
        ringStyle,
      ]}
    />
  );
});

/** Single waveform bar — pulses opacity in a phase-shifted loop. */
const WaveformBar = React.memo(({ index, height, active }: {
  index: number;
  height: number;
  active: boolean;
}) => {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity);
      opacity.value = 0.4;
      return;
    }
    const dur = 800 + (index % 3) * 200;
    opacity.value = withDelay(
      index * 50,
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: dur, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [active, index, opacity]);
  const barStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[inkStyles.waveBar, { height }, barStyle]} />
  );
});

/** Glassy waveform pill that floats at the bottom of the orb. Only
 *  visible while the user (or assistant) is speaking. */
function WaveformPill({ active }: { active: boolean }) {
  const heights = [14, 8, 22, 12, 18, 10, 20, 14, 10, 16];
  return (
    <View style={inkStyles.wavePill} pointerEvents="none">
      {heights.map((h, i) => (
        <WaveformBar key={i} index={i} height={h} active={active} />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function VoiceAgentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>('english');
  const [showHindiScreen, setShowHindiScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showCrisisWarning, setShowCrisisWarning] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);

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

  // ── Voice session tracking (Supabase persistence) ──
  const voiceSessionIdRef = useRef<string | null>(null);
  const voiceStartTimeRef = useRef<number>(0);
  const voiceTranscriptRef = useRef<VoiceTranscriptEntry[]>([]);
  const humeChatGroupIdRef = useRef<string>('');
  const sessionEndedRef = useRef(false); // guard against double-finalize
  // user_context for this call — preserved in refs so mid-call sendSessionSettings
  // (interventions) can re-include it (matching WhatsApp agent behaviour)
  const userContextRef = useRef<string>('');

  // Real-time title (generated after first user turn, same pattern as text chat)
  const [voiceChatTitle, setVoiceChatTitle] = useState<string | null>(null);
  const titleGeneratedRef = useRef(false); // prevent duplicate generation per session

  // Intervention system state (inline per plan)
  const [currentIntervention, setCurrentIntervention] = useState<InterventionDecision | null>(null);
  const currentInterventionRef = useRef<InterventionDecision | null>(null); // For use in callbacks
  const detectorStateRef = useRef<InterventionDetectorState>(getInitialInterventionDetectorState());
  const lastSentTypeRef = useRef<string | null>(null);
  const ttlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gradient speaker ──
  const gradientSpeaker = useMemo(() => {
    if (callState !== 'active') return 'mello' as const;
    if (isUserSpeaking) return 'user' as const;
    return 'mello' as const;
  }, [callState, isUserSpeaking]);

  // Close sidebar when leaving the voice tab
  useFocusEffect(useCallback(() => {
    return () => { sidebarStore.close(); };
  }, []));

  // Load user email for sidebar display
  useEffect(() => {
    getSession().then((session) => {
      if (session?.email) {
        sidebarStore.setContext({
          currentSessionId: '',
          currentTitle: 'Voice Chat',
          userEmail: session.email,
        });
      }
    });
  }, []);

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
          autoExpand={currentIntervention !== null && isHighPriorityIntervention(currentIntervention.type)}
        />
      )}
    </>
  ), [isWaitingForResponse, showCrisisWarning, handleCrisisConnect, currentIntervention]);

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

      // Append to transcript ref and persist
      if (voiceSessionIdRef.current) {
        const entry: VoiceTranscriptEntry = {
          role: 'user',
          text,
          timestamp: Date.now(),
          emotions: emotions.top3,
        };
        voiceTranscriptRef.current = [...voiceTranscriptRef.current, entry];
        updateVoiceTranscript(voiceSessionIdRef.current, voiceTranscriptRef.current);
      }

      // Generate title after first user turn (Hume speaks first, so transcript
      // already has at least one assistant entry — same pattern as text chat)
      if (!titleGeneratedRef.current) {
        titleGeneratedRef.current = true;
        const msgs = voiceTranscriptRef.current.map((t) => ({
          role: t.role as 'user' | 'assistant',
          content: [{ text: t.text }] as [{ text: string }],
        }));
        generateChatTitle(msgs).then((title) => {
          if (title) setVoiceChatTitle(title);
        });
      }

      // Run intervention detection
      const humeMessage = {
        type: 'user_message',
        message: { content: text },
        models: { prosody: { scores: emotions.raw } },
      };

      console.log('[Intervention] Running detection on:', text.substring(0, 50));
      const nextIntervention = detectIntervention(
        humeMessage,
        detectorStateRef.current,
        Date.now(),
      );

      if (nextIntervention) {
        console.log('[Intervention] Detected:', nextIntervention.type, 'priority:', nextIntervention.priority);
        // Check priority - only override if same or higher priority (use ref for current value)
        const currentPriority = currentInterventionRef.current?.priority ?? -1;
        if (nextIntervention.priority >= currentPriority) {
          currentInterventionRef.current = nextIntervention;
          setCurrentIntervention(nextIntervention);
          detectorStateRef.current.lastDecisionType = nextIntervention.type;
          detectorStateRef.current.lastDecisionAt = Date.now();
        }
      } else {
        console.log('[Intervention] No intervention detected');
      }

      // Crisis detection (keep for call/text button UI)
      const hasCrisisKeyword = detectCrisis(text);
      const hasHighDistress = emotions.top3.some(
        (e) => DISTRESS_EMOTIONS.includes(e.name) && e.score > DISTRESS_THRESHOLD,
      );
      // Show crisis warning for high-priority interventions OR existing crisis detection
      if (
        (nextIntervention && isHighPriorityIntervention(nextIntervention.type)) ||
        hasCrisisKeyword ||
        hasHighDistress
      ) {
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

      // Append to transcript ref and persist
      if (voiceSessionIdRef.current) {
        const entry: VoiceTranscriptEntry = { role: 'assistant', text, timestamp: Date.now() };
        voiceTranscriptRef.current = [...voiceTranscriptRef.current, entry];
        updateVoiceTranscript(voiceSessionIdRef.current, voiceTranscriptRef.current);
      }
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

    onConnected: (chatId: string, chatGroupId: string) => {
      console.log('[Hume] connected, chatId:', chatId, 'chatGroupId:', chatGroupId.substring(0, 20));
      setCallState('active');
      // Store Hume IDs in DB
      humeChatGroupIdRef.current = chatGroupId;
      if (voiceSessionIdRef.current) {
        updateHumeIds(voiceSessionIdRef.current, chatId, chatGroupId);
      }
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
  // INTERVENTION COORDINATOR
  // ═══════════════════════════════════════════════════

  // Send intervention guidance to Hume when intervention changes
  useEffect(() => {
    if (callState !== 'active' || !humeServiceRef.current) return;

    if (currentIntervention && lastSentTypeRef.current !== currentIntervention.type) {
      // Send guidance to Hume — always include user_context to preserve it
      console.log('[Intervention] Sending guidance to Hume:', currentIntervention.type);
      humeServiceRef.current.sendSessionSettings({
        intervention_guidance: currentIntervention.guidance,
        user_context: userContextRef.current,
      });
      lastSentTypeRef.current = currentIntervention.type;

      // Set TTL timeout to clear intervention
      if (ttlTimeoutRef.current) clearTimeout(ttlTimeoutRef.current);
      ttlTimeoutRef.current = setTimeout(() => {
        console.log('[Intervention] TTL expired, clearing guidance');
        humeServiceRef.current?.sendSessionSettings({
          intervention_guidance: '',
          user_context: userContextRef.current,
        });
        currentInterventionRef.current = null;
        setCurrentIntervention(null);
        lastSentTypeRef.current = null;
      }, currentIntervention.ttlMs);
    } else if (!currentIntervention && lastSentTypeRef.current) {
      // Clear guidance
      humeServiceRef.current.sendSessionSettings({
        intervention_guidance: '',
        user_context: userContextRef.current,
      });
      lastSentTypeRef.current = null;
    }
  }, [currentIntervention, callState]);

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
    // ── Hindi: use LiveKit + Sarvam ──
    if (selectedLanguage === 'hindi') {
      console.log('[Mello] === Starting Hindi voice (LiveKit + Sarvam) ===');
      setShowHindiScreen(true);
      return;
    }

    // ── English: use Hume EVI ──
    console.log('[Mello] === Starting call with English voice (Hume) ===');
    setCallState('connecting');
    setMessages([]);
    setShowCrisisWarning(false);
    setIsUserSpeaking(false);
    setIsWaitingForResponse(false);
    setShowTranscript(true);  // Show transcript by default
    assistantSpeakingRef.current = false;
    msgIdCounter = 0;
    animatedIdsRef.current.clear();

    // Reset session tracking refs
    voiceSessionIdRef.current = null;
    voiceTranscriptRef.current = [];
    humeChatGroupIdRef.current = '';
    sessionEndedRef.current = false;
    voiceStartTimeRef.current = Date.now();
    titleGeneratedRef.current = false;
    setVoiceChatTitle(null);

    // ── DEV MODE: skip Hume, play fake conversation ──
    if (DEV_MODE) {
      setTimeout(() => startDevConversation(), 800);
      return;
    }

    // ── PRODUCTION: connect to Hume EVI ──
    if (!HUME_API_KEY || !HUME_DEFAULT_CONFIG_ID) {
      console.error('[Mello] Hume API key or config ID not set');
      return;
    }

    try {
      console.log('[Mello] NativeAudio available:', !!NativeAudio);

      // Fetch resume context + start DB session in parallel
      const { data: { user } } = await supabase.auth.getUser();
      let resumedChatGroupId: string | null = null;
      let userContextText = '';

      if (user) {
        const [context, sessionId] = await Promise.all([
          getVoiceSessionContext(user.id),
          startVoiceSession(user.id),
        ]);
        voiceSessionIdRef.current = sessionId;
        resumedChatGroupId = context.hume_chat_group_id;
        userContextText = context.user_context_text;
        userContextRef.current = userContextText;
        console.log('[Mello] Voice session created:', sessionId, 'resume group:', resumedChatGroupId?.substring(0, 20));
      }

      // Request microphone permission using expo-av
      console.log('[Mello] Requesting audio permissions...');
      const { granted } = await Audio.requestPermissionsAsync();
      console.log('[Mello] Permissions granted:', granted);
      if (!granted) {
        console.warn('[Mello] Audio permissions denied, returning to idle');
        setCallState('idle');
        return;
      }

      if (!NativeAudio) {
        console.warn('[Mello] NativeAudio not available - run npx expo prebuild first');
        setCallState('idle');
        return;
      }

      // Configure audio mode for voice chat
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      console.log('[Mello] Connecting to Hume EVI...');
      const service = new HumeEVIService(
        HUME_API_KEY,
        HUME_DEFAULT_CONFIG_ID,
        humeCallbacks,
        undefined,          // sampleRate — use platform default
        resumedChatGroupId, // pass group ID to resume conversation memory
        // All EVI config variables must be in the very first session_settings,
        // otherwise Hume fires "no values specified" before a second message arrives
        {
          user_context: userContextText,
          intervention_guidance: '',
        },
      );
      humeServiceRef.current = service;
      await service.connect();
      console.log('[Mello] Hume WebSocket connected!');

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
  }, [humeCallbacks, selectedLanguage, startDevConversation]);

  const handleEndCall = useCallback(async () => {
    console.log('[Mello] === Ending call ===');

    // Snapshot session id + transcript length BEFORE any cleanup so we
    // can decide whether to navigate to the post-call summary screen.
    // navigateToSummary is only true if a real conversation happened —
    // empty transcripts (cancelled/aborted calls) skip the summary and
    // return to /call (pre-session).
    const summarySessionId = voiceSessionIdRef.current;
    const navigateToSummary = !!summarySessionId && voiceTranscriptRef.current.length > 0;
    console.log('[Mello] handleEndCall snapshot — sessionId=' + (summarySessionId ?? 'none'), 'navigateToSummary=' + navigateToSummary);

    // Finalize voice session (non-blocking — fire and forget)
    if (
      voiceSessionIdRef.current &&
      voiceTranscriptRef.current.length > 0 &&
      !sessionEndedRef.current
    ) {
      sessionEndedRef.current = true;
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user) {
        finalizeVoiceSession(
          voiceSessionIdRef.current,
          user.id,
          humeChatGroupIdRef.current,
          voiceStartTimeRef.current,
          voiceTranscriptRef.current,
        );
      }
    }

    try {
      // Clear dev timers
      devTimersRef.current.forEach(clearTimeout);
      devTimersRef.current = [];

      // Stop audio - wrap each call individually to prevent cascade failures
      if (!DEV_MODE && NativeAudio) {
        try {
          await NativeAudio.stopPlayback().catch(() => {});
        } catch (err) {
          console.warn('[Mello] Error stopping playback:', err);
        }
        try {
          await NativeAudio.unmute().catch(() => {});
        } catch (err) {
          console.warn('[Mello] Error unmuting:', err);
        }
        try {
          await NativeAudio.stopRecording().catch(() => {});
        } catch (err) {
          console.warn('[Mello] Error stopping recording:', err);
        }
      }

      // Remove listeners safely
      try {
        audioListenerRef.current?.remove();
      } catch (err) {
        console.warn('[Mello] Error removing audio listener:', err);
      }
      audioListenerRef.current = null;

      try {
        playbackCompleteListenerRef.current?.remove();
      } catch (err) {
        console.warn('[Mello] Error removing playback listener:', err);
      }
      playbackCompleteListenerRef.current = null;

      // Disconnect Hume safely
      try {
        humeServiceRef.current?.disconnect();
      } catch (err) {
        console.warn('[Mello] Error disconnecting Hume:', err);
      }
      humeServiceRef.current = null;

      // Clear timeouts
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (ttlTimeoutRef.current) clearTimeout(ttlTimeoutRef.current);

      // Clear intervention state
      currentInterventionRef.current = null;
      detectorStateRef.current = getInitialInterventionDetectorState();
      lastSentTypeRef.current = null;

    } catch (err) {
      console.error('[Mello] Error in handleEndCall:', err);
    } finally {
      // Return straight to idle — no "ended" limbo screen
      setCallState('idle');
      setMessages([]);
      setShowCrisisWarning(false);
      setShowTranscript(false);
      setIsAssistantSpeaking(false);
      setIsUserSpeaking(false);
      setIsWaitingForResponse(false);
      setIsFullscreen(false);
      setVoiceChatTitle(null);
      assistantSpeakingRef.current = false;
      setCurrentIntervention(null);
      titleGeneratedRef.current = false;

      // Hand off to the post-call summary screen if a real conversation
      // happened. router.replace pops /voice-active off the stack so
      // back from /voice-summary lands on /call (pre-session) — exactly
      // the flow the user expects after a session ends.
      if (navigateToSummary && summarySessionId) {
        console.log('[Mello] navigating to /voice-summary?id=' + summarySessionId);
        router.replace(`/voice-summary?id=${summarySessionId}` as any);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);


  const handleHindiBack = useCallback(() => {
    setShowHindiScreen(false);
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

  /* ─── Auto-start (SelfMind redesign) ─────────────────────────────
   *
   * /voice-active is reached only via SelfMindVoicePre's "Start voice"
   * tap, so the user has already opted in. Auto-fire handleStartCall
   * on mount so the screen lands directly in the connecting → active
   * sequence — no second "Start" button required. Single-fire ref
   * prevents double-start under React 18 strict-mode double-mount. */
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (callState !== 'idle') return;
    if (showHindiScreen) return;
    autoStartedRef.current = true;
    console.log('[Mello] [render] auto-starting voice session on mount');
    void handleStartCall();
  }, [callState, showHindiScreen, handleStartCall]);

  // Sync local fullscreen state to the external store via useEffect.
  // This avoids "Cannot update component X while rendering Y" errors
  // that happened when fullscreenStore.set() was called inside setState.
  useEffect(() => {
    fullscreenStore.set(isFullscreen);
  }, [isFullscreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Finalize any active session on unmount (app backgrounded / tab changed)
      if (
        voiceSessionIdRef.current &&
        voiceTranscriptRef.current.length > 0 &&
        !sessionEndedRef.current
      ) {
        sessionEndedRef.current = true;
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            finalizeVoiceSession(
              voiceSessionIdRef.current!,
              user.id,
              humeChatGroupIdRef.current,
              voiceStartTimeRef.current,
              voiceTranscriptRef.current,
            );
          }
        }).catch(() => { /* ignore */ });
      }

      try {
        fullscreenStore.set(false);
        devTimersRef.current.forEach(clearTimeout);
        try { audioListenerRef.current?.remove(); } catch (e) { /* ignore */ }
        try { playbackCompleteListenerRef.current?.remove(); } catch (e) { /* ignore */ }
        try { humeServiceRef.current?.disconnect(); } catch (e) { /* ignore */ }
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (ttlTimeoutRef.current) clearTimeout(ttlTimeoutRef.current);
        if (NativeAudio) {
          NativeAudio.stopPlayback().catch(() => { });
          NativeAudio.stopRecording().catch(() => { });
        }
      } catch (err) {
        console.warn('[Mello] Cleanup error:', err);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  // Avatar placeholder (when transcript is hidden or idle)
  const renderAvatarPlaceholder = () => (
    <View style={styles.avatarContainer}>
      <View style={styles.avatarCircle}>
        <Image
          source={require('@/assets/mello-mascot.png')}
          style={styles.mascotImage}
        />
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

  // Idle screen — language selector (English or Hindi)
  const renderIdleScreen = () => (
    <View style={styles.idleContainer}>
      <View style={styles.avatarCircle}>
        <Image
          source={require('@/assets/mello-mascot.png')}
          style={styles.mascotImage}
        />
      </View>
      <Text style={styles.idleGreeting}>{getVoiceGreeting()}</Text>
      <View style={styles.voiceSelector}>
        <Text style={styles.voiceSelectorLabel}>language</Text>
        <View style={styles.voiceChips}>
          <Pressable
            style={[
              styles.voiceChip,
              selectedLanguage === 'english' && styles.voiceChipSelected,
              selectedLanguage !== 'english' && styles.voiceChipMuted,
            ]}
            onPress={() => setSelectedLanguage('english')}
          >
            <Text
              style={[
                styles.voiceChipLabel,
                selectedLanguage === 'english' && styles.voiceChipLabelSelected,
              ]}
            >
              English
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.voiceChip,
              selectedLanguage === 'hindi' && !DISABLE_HINDI_FOR_DEMO && styles.voiceChipSelectedHindi,
              (selectedLanguage !== 'hindi' || DISABLE_HINDI_FOR_DEMO) && styles.voiceChipMuted,
              DISABLE_HINDI_FOR_DEMO && styles.voiceChipDisabled,
            ]}
            onPress={() => !DISABLE_HINDI_FOR_DEMO && setSelectedLanguage('hindi')}
            disabled={DISABLE_HINDI_FOR_DEMO}
          >
            <Text
              style={[
                styles.voiceChipLabel,
                selectedLanguage === 'hindi' && !DISABLE_HINDI_FOR_DEMO && styles.voiceChipLabelSelectedHindi,
                DISABLE_HINDI_FOR_DEMO && styles.voiceChipLabelDisabled,
              ]}
            >
              Hindi
            </Text>
            {DISABLE_HINDI_FOR_DEMO && (
              <Text style={styles.comingSoonBadge}>Coming Soon</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Hindi voice path is preserved (handlers + state) but unreachable
  // from the SelfMind redesign UI — language defaults to English.
  if (showHindiScreen) {
    return <HindiVoiceScreen onBack={handleHindiBack} />;
  }

  // ── SelfMind redesign — Active Session view (MBVoiceActive port)
  // Inks the canvas, replaces the chat-list view with a single-quote
  // moment + breathing orb + waveform. All hooks above (Hume EVI,
  // NativeAudio, AEC, transcript, crisis, intervention) are preserved
  // verbatim — only the JSX render is replaced.

  // Resolve the last user quote for the centered headline. Falls back
  // to a soft prompt while we wait for the first user turn.
  const lastUserQuote: string | null = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].text;
    }
    return null;
  })();

  // LIVE pill should only appear once we're truly in 'active' state.
  // Connecting / idle show a softer transitional kicker instead.
  const headerKicker =
    callState === 'active'   ? null :
    callState === 'connecting' ? 'CONNECTING…' :
    'JUST A MOMENT…';

  console.log(
    '[Mello] [render] callState=' + callState,
    'isUserSpeaking=' + isUserSpeaking,
    'isAssistantSpeaking=' + isAssistantSpeaking,
    'isMuted=' + isMuted,
    'msgs=' + messages.length,
  );

  const pulseActive = callState === 'active';
  const waveActive = callState === 'active' && (isUserSpeaking || isAssistantSpeaking);

  return (
    <View style={inkStyles.container}>
      {/* Top bar — empty left, LIVE pill on right */}
      <View style={[inkStyles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={inkStyles.topSide} />
        <View style={inkStyles.topSide} />
        {callState === 'active' ? (
          <View style={inkStyles.livePill}>
            <View style={inkStyles.liveDot} />
            <Text style={inkStyles.liveText}>LIVE</Text>
          </View>
        ) : (
          <View style={inkStyles.topSide} />
        )}
      </View>

      {/* Body — header (timer + last quote) + center orb + footer controls */}
      <View style={inkStyles.body}>
        {/* Header text */}
        <View style={inkStyles.headerWrap}>
          {headerKicker ? (
            <Text style={inkStyles.sessionLabel}>{headerKicker}</Text>
          ) : (
            <SessionTimer isActive={callState === 'active'} />
          )}
          <Text style={inkStyles.lastQuote} numberOfLines={3}>
            {lastUserQuote
              ? `“${lastUserQuote}”`
              : callState === 'active'
                ? 'I’m listening — start whenever you’re ready.'
                : ''}
          </Text>
        </View>

        {/* Crisis warning + intervention indicator preserved (above orb) */}
        {showCrisisWarning && (
          <View style={inkStyles.crisisWrap}>
            <CrisisInlineWarning
              onConnect={handleCrisisConnect}
              onDismiss={() => setShowCrisisWarning(false)}
              autoExpand={
                currentIntervention !== null &&
                isHighPriorityIntervention(currentIntervention.type)
              }
            />
          </View>
        )}
        {callState === 'active' && currentIntervention && (
          <View style={inkStyles.interventionWrap}>
            <InterventionIndicator
              intervention={currentIntervention}
              isActive={callState === 'active'}
            />
          </View>
        )}

        {/* Orb stack — 3 pulse rings + breathing orb + waveform pill */}
        <View style={inkStyles.orbBox}>
          {[0, 1, 2].map((i) => (
            <PulseRing key={i} index={i} baseSize={280} active={pulseActive} />
          ))}
          <View style={inkStyles.orbCenter}>
            <SelfMindOrb size={240} seed={7} />
          </View>
          <View style={inkStyles.wavePillWrap} pointerEvents="none">
            <WaveformPill active={waveActive} />
          </View>
        </View>

        {/* Bottom controls — Close, Big End, Chat (transcript) */}
        <View style={inkStyles.controlsRow}>
          <TouchableOpacity
            style={inkStyles.smallControl}
            onPress={() => {
              console.log('[Mello] [render] close (X) tapped → handleEndCall');
              handleEndCall();
            }}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Glyphs.Close size={18} color={C.cream} />
          </TouchableOpacity>

          <TouchableOpacity
            style={inkStyles.endBigBtn}
            onPress={() => {
              console.log('[Mello] [render] big end tapped → handleEndCall');
              handleEndCall();
            }}
            activeOpacity={0.85}
          >
            <View style={inkStyles.endBigBtnInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              inkStyles.smallControl,
              isMuted && inkStyles.smallControlActive,
            ]}
            onPress={() => {
              console.log('[Mello] [render] mute tapped → handleToggleMute (was ' + isMuted + ')');
              handleToggleMute();
            }}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={20}
              color={isMuted ? C.coral : C.cream}
            />
          </TouchableOpacity>
        </View>
      </View>

      <VoiceInfoSheet visible={showInfoSheet} onClose={() => setShowInfoSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // ── Voice Header ──
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  voiceHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  voiceLogoText: {
    fontFamily: 'Playwrite',
    fontSize: 26,
    color: '#1A1A1A',
    lineHeight: 32,
    marginBottom: 10,
  },
  voiceHeaderSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
  },
  voiceHeaderTitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
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
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascotImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarStatusText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // ── Idle screen ──
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  idleGreeting: {
    fontSize: 32,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 42,
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
  voiceChipMuted: {
    opacity: 0.5,
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
  voiceChipSelectedHindi: {
    backgroundColor: 'rgba(249, 168, 212, 0.25)',
    borderColor: '#F9A8D4',
  },
  voiceChipLabelSelectedHindi: {
    color: '#F9A8D4',
  },
  voiceChipSubtitleSelectedHindi: {
    color: '#F9A8D4',
  },
  voiceChipDisabled: {
    opacity: 0.5,
    borderStyle: 'dashed',
  },
  voiceChipLabelDisabled: {
    color: LIGHT_THEME.textMuted,
  },
  comingSoonBadge: {
    fontSize: 9,
    fontFamily: 'Outfit-Medium',
    color: '#F9A8D4',
    backgroundColor: 'rgba(249, 168, 212, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
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
  startPillHindi: {
    backgroundColor: 'rgba(249, 168, 212, 0.25)',
    borderColor: 'rgba(249, 168, 212, 0.45)',
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


/* ─── SelfMind redesign — Active Session styles ─────────────────── */

const inkStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1F36", // C.ink
  },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSide: { width: 60, height: 32 },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#F4A988", // C.coral
  },
  liveText: {
    fontFamily: "JetBrainsMono-Medium",
    fontSize: 11,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.7)",
  },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 120,
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerWrap: {
    paddingTop: 12,
    alignItems: "center",
  },
  sessionLabel: {
    fontFamily: "JetBrainsMono-Medium",
    fontSize: 11,
    letterSpacing: 2.2,
    color: "rgba(255,255,255,0.5)",
  },
  lastQuote: {
    marginTop: 12,
    fontFamily: "Fraunces-Medium",
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: "#FBF5EE", // C.cream
    textAlign: "center",
    maxWidth: 320,
  },

  crisisWrap: {
    width: "100%",
    paddingHorizontal: 4,
  },
  interventionWrap: {
    width: "100%",
    alignItems: "center",
  },

  orbBox: {
    width: 280,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  orbCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(244,169,136,0.22)",
  },
  wavePillWrap: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  wavePill: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  waveBar: {
    width: 3,
    backgroundColor: "#FBF5EE", // C.cream
    borderRadius: 2,
  },

  controlsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smallControl: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  smallControlActive: {
    backgroundColor: "rgba(244,169,136,0.18)",
  },
  endBigBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "#F4A988", // C.coral
    alignItems: "center", justifyContent: "center",
    shadowColor: "#F4A988",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 10,
  },
  endBigBtnInner: {
    width: 22, height: 22, borderRadius: 4,
    backgroundColor: "#1A1F36", // C.ink
  },
});

