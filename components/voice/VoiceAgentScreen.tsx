/**
 * VoiceAgentScreen Component
 * Full-screen animated gradient with Hume AI EVI speech-to-speech
 *
 * Audio pipeline:
 *   NativeAudio (mic) → HumeEVIService (WebSocket) → NativeAudio (speaker)
 *
 * Hume handles: STT + emotion detection + LLM + TTS
 * We handle: UI, gradient, crisis detection, audio I/O
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import NativeAudio from '@/modules/audio';
import { HumeEVIService, EmotionScores } from '@/utils/humeService';
import VoiceGradientBg from './VoiceGradientBg';
import CrisisInlineWarning from './CrisisInlineWarning';
import TypewriterText from '@/components/chat/TypewriterText';
import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import { detectCrisis, callCrisisLine } from '@/utils/crisisDetection';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

type CallState = 'idle' | 'connecting' | 'active' | 'ended';

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const HUME_API_KEY = process.env.EXPO_PUBLIC_HUME_API_KEY || '';
const HUME_CONFIG_ID = process.env.EXPO_PUBLIC_HUME_CONFIG_ID || '';

// Emotion names that indicate distress (for enhanced crisis detection)
const DISTRESS_EMOTIONS = ['Distress', 'Sadness', 'Fear', 'Pain', 'Anxiety', 'Desperation'];
const DISTRESS_THRESHOLD = 0.6;

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function VoiceAgentScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [showCrisisWarning, setShowCrisisWarning] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Hume EVI state
  const [userTranscript, setUserTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [topEmotions, setTopEmotions] = useState<Array<{ name: string; score: number }>>([]);
  const [displayedMsgId, setDisplayedMsgId] = useState('');
  const [currentMsgId, setCurrentMsgId] = useState('');

  // Service ref (persists across renders)
  const humeServiceRef = useRef<HumeEVIService | null>(null);
  const audioListenerRef = useRef<any>(null);

  // ── Call timer ──
  useEffect(() => {
    if (callState !== 'active') return;
    const interval = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── Gradient props ──
  const gradientSpeaker = useMemo(() => {
    if (callState !== 'active') return 'mello' as const;
    if (isAssistantSpeaking) return 'mello' as const;
    if (userTranscript) return 'user' as const;
    return 'mello' as const;
  }, [callState, isAssistantSpeaking, userTranscript]);

  const isCallActive = callState === 'active' || callState === 'connecting';

  // ═══════════════════════════════════════════════════
  // HUME EVI CALLBACKS
  // ═══════════════════════════════════════════════════

  const humeCallbacks = useMemo(() => ({
    onUserMessage: (text: string, emotions: EmotionScores) => {
      setUserTranscript(text);
      setTopEmotions(emotions.top3);

      // Enhanced crisis detection: keyword + emotion
      const hasCrisisKeyword = detectCrisis(text);
      const hasHighDistress = emotions.top3.some(
        (e) => DISTRESS_EMOTIONS.includes(e.name) && e.score > DISTRESS_THRESHOLD,
      );
      if (hasCrisisKeyword || hasHighDistress) {
        setShowCrisisWarning(true);
      }
    },

    onAssistantMessage: (text: string) => {
      setUserTranscript(''); // Clear user transcript
      setAssistantText(text);
      setIsAssistantSpeaking(true);
      setCurrentMsgId(Date.now().toString());
    },

    onAudioOutput: async (base64Audio: string) => {
      try {
        await NativeAudio.enqueueAudio(base64Audio);
      } catch {
        // Audio playback error — text still shows
      }
    },

    onUserInterruption: async () => {
      try {
        await NativeAudio.stopPlayback();
      } catch {}
      setIsAssistantSpeaking(false);
    },

    onAssistantEnd: () => {
      setIsAssistantSpeaking(false);
    },

    onConnected: (chatId: string) => {
      setCallState('active');
    },

    onDisconnected: () => {
      // Only update if we didn't intentionally end
      setCallState((prev) => (prev === 'active' ? 'ended' : prev));
    },

    onError: (error: string) => {
      console.warn('[Hume EVI]', error);
    },
  }), []);

  // ═══════════════════════════════════════════════════
  // CALL HANDLERS
  // ═══════════════════════════════════════════════════

  const handleStartCall = useCallback(async () => {
    if (!HUME_API_KEY || !HUME_CONFIG_ID) {
      console.error('Hume API key or config ID not set');
      return;
    }

    setCallState('connecting');
    setCallDuration(0);
    setUserTranscript('');
    setAssistantText('');
    setTopEmotions([]);
    setShowCrisisWarning(false);
    setDisplayedMsgId('');
    setCurrentMsgId('');

    try {
      // Request mic permission
      const granted = await NativeAudio.getPermissions();
      if (!granted) {
        setCallState('idle');
        return;
      }

      // Create and connect Hume EVI service
      const service = new HumeEVIService(
        HUME_API_KEY,
        HUME_CONFIG_ID,
        humeCallbacks,
      );
      humeServiceRef.current = service;
      await service.connect();

      // Start streaming mic audio to Hume
      audioListenerRef.current = NativeAudio.addListener(
        'onAudioInput',
        ({ base64EncodedAudio }) => {
          service.sendAudio(base64EncodedAudio);
        },
      );

      await NativeAudio.startRecording();
    } catch (err) {
      console.error('Failed to start call:', err);
      setCallState('idle');
    }
  }, [humeCallbacks]);

  const handleEndCall = useCallback(async () => {
    // Stop audio capture
    try {
      await NativeAudio.stopRecording();
      await NativeAudio.stopPlayback();
    } catch {}

    // Remove audio listener
    audioListenerRef.current?.remove();
    audioListenerRef.current = null;

    // Disconnect Hume
    humeServiceRef.current?.disconnect();
    humeServiceRef.current = null;

    setCallState('ended');
    setIsAssistantSpeaking(false);
  }, []);

  const handleNewCall = useCallback(() => {
    setCallState('idle');
    setUserTranscript('');
    setAssistantText('');
    setTopEmotions([]);
    setCallDuration(0);
    setShowCrisisWarning(false);
    setDisplayedMsgId('');
    setCurrentMsgId('');
  }, []);

  const handleToggleMute = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      if (newMuted) {
        await NativeAudio.mute();
      } else {
        await NativeAudio.unmute();
      }
    } catch {}
  }, [isMuted]);

  const handleCrisisConnect = useCallback(() => {
    callCrisisLine();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioListenerRef.current?.remove();
      humeServiceRef.current?.disconnect();
      NativeAudio.stopRecording().catch(() => {});
      NativeAudio.stopPlayback().catch(() => {});
    };
  }, []);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  const handleTypewriterComplete = useCallback(() => {
    setDisplayedMsgId(currentMsgId);
  }, [currentMsgId]);

  const renderContent = () => {
    // Idle state
    if (callState === 'idle') {
      return <Text style={styles.statusText}>Tap to start talking</Text>;
    }

    // Connecting
    if (callState === 'connecting') {
      return <Text style={styles.statusText}>Connecting to mello...</Text>;
    }

    // Ended
    if (callState === 'ended') {
      return <Text style={styles.statusText}>Session ended</Text>;
    }

    // Active — muted
    if (isMuted) {
      return (
        <Text style={styles.statusText}>
          Psst... <Text style={styles.statusHighlight}>unmute</Text> so{' '}
          <Text style={styles.melloText}>mello</Text> can hear you
        </Text>
      );
    }

    // Active — user speaking (show their transcript)
    if (userTranscript) {
      return (
        <View style={styles.transcriptContainer}>
          <Text style={styles.speakerLabel}>You</Text>
          <Text style={styles.liveTranscriptText}>{userTranscript}</Text>
          {topEmotions.length > 0 && (
            <View style={styles.emotionRow}>
              {topEmotions.map((e) => (
                <Text key={e.name} style={styles.emotionBadge}>
                  {e.name} {(e.score * 100).toFixed(0)}%
                </Text>
              ))}
            </View>
          )}
        </View>
      );
    }

    // Active — mello speaking (show response with typewriter)
    if (assistantText) {
      const isNew = currentMsgId !== displayedMsgId;

      return (
        <ScrollView
          ref={scrollRef}
          style={styles.transcriptScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.transcriptScrollContent}
        >
          <Text style={styles.speakerLabel}>mello</Text>
          {isNew ? (
            <TypewriterText
              text={assistantText}
              speed={25}
              style={styles.transcriptText}
              onComplete={handleTypewriterComplete}
            />
          ) : (
            <Text style={styles.transcriptText}>{assistantText}</Text>
          )}

          {showCrisisWarning && (
            <CrisisInlineWarning
              onConnect={handleCrisisConnect}
              onDismiss={() => setShowCrisisWarning(false)}
            />
          )}
        </ScrollView>
      );
    }

    // Active — listening, waiting for speech
    return (
      <Text style={styles.statusText}>
        <Text style={styles.melloText}>mello</Text>
        <Text style={styles.statusAccent}> listening</Text>, say what's on your mind
      </Text>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Animated gradient background */}
      <VoiceGradientBg speaker={gradientSpeaker} isActive={isCallActive} />

      {/* Timer */}
      <View style={styles.timerSection}>
        {callState === 'active' && (
          <View style={styles.timerRow}>
            <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
            {!isMuted && !isAssistantSpeaking && (
              <View style={styles.listeningDot} />
            )}
            {isAssistantSpeaking && (
              <View style={styles.speakingDot} />
            )}
          </View>
        )}
      </View>

      {/* Content — fills center area */}
      <View style={styles.contentSection}>
        {renderContent()}
      </View>

      {/* Controls */}
      <View style={[styles.controlsBar, { paddingBottom: 24 }]}>
        {callState === 'idle' && (
          <Pressable style={styles.startButton} onPress={handleStartCall}>
            <Ionicons name="mic" size={28} color="#FFFFFF" />
          </Pressable>
        )}

        {callState === 'connecting' && (
          <Pressable style={styles.endButton} onPress={handleEndCall}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        )}

        {callState === 'active' && (
          <View style={styles.activeControls}>
            <Pressable
              style={[styles.micButton, isMuted && styles.micButtonMuted]}
              onPress={handleToggleMute}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color={isMuted ? '#E53E3E' : '#FFFFFF'}
              />
            </Pressable>

            <Pressable style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="call" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {callState === 'ended' && (
          <Pressable style={styles.startButton} onPress={handleNewCall}>
            <Ionicons name="refresh" size={28} color="#FFFFFF" />
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
    fontSize: 18,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
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

  // Content — expanded center
  contentSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statusHighlight: {
    color: '#E53E3E',
    fontFamily: 'Outfit-Medium',
  },
  statusAccent: {
    color: LIGHT_THEME.accent,
    fontFamily: 'Outfit-Medium',
  },
  melloText: {
    fontFamily: 'Outfit-Medium',
    fontStyle: 'italic',
  },

  // Transcript container
  transcriptContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  speakerLabel: {
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textMuted,
    textTransform: 'lowercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  liveTranscriptText: {
    fontSize: 20,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },

  // Emotion badges
  emotionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  emotionBadge: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
    backgroundColor: 'rgba(185, 166, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Transcript scroll (mello response)
  transcriptScroll: {
    flex: 1,
    width: '100%',
  },
  transcriptScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  transcriptText: {
    fontSize: 20,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    lineHeight: 30,
    textAlign: 'center',
  },

  // Controls
  controlsBar: {
    alignItems: 'center',
    gap: 16,
  },
  startButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LIGHT_THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  endButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  activeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LIGHT_THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  micButtonMuted: {
    backgroundColor: LIGHT_THEME.surface,
    borderWidth: 2,
    borderColor: '#E53E3E',
  },
});
