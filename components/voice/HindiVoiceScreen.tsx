/**
 * HindiVoiceScreen Component
 * Hindi voice conversation with Sarvam AI via LiveKit
 *
 * Uses LiveKit React Native SDK for WebRTC audio streaming.
 * Python Sarvam agent joins the same room for Hindi STT/TTS.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Participant,
  Track,
  DataPacket_Kind,
} from 'livekit-client';
import { AudioSession, registerGlobals } from '@livekit/react-native';

// Register WebRTC globals for LiveKit (MUST be called before using Room)
registerGlobals();

import MelloGradient from '@/components/common/MelloGradient';
import CrisisInlineWarning from './CrisisInlineWarning';
import TypingIndicator from '@/components/get-rolling/TypingIndicator';
import FadingScrollWrapper from '@/components/get-rolling/ScrollFadeEdges';
import TranscriptIcon from './TranscriptIcon';
import { LIGHT_THEME } from '@/components/common/LightGradient';
import { detectCrisis, callCrisisLine } from '@/utils/crisisDetection';
import { fetchLiveKitToken, LiveKitConnectionData } from '@/utils/livekitService';
import { fullscreenStore } from '@/utils/fullscreenStore';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const { width: SCREEN_WIDTH } = Dimensions.get('window');

let msgIdCounter = 0;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════
// CHAT BUBBLE (memoized)
// ═══════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════
// CALL TIMER (self-contained)
// ═══════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════

interface HindiVoiceScreenProps {
  onBack: () => void;
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function HindiVoiceScreen({ onBack }: HindiVoiceScreenProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showCrisisWarning, setShowCrisisWarning] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // Speaking state
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs
  const roomRef = useRef<Room | null>(null);
  const animatedIdsRef = useRef<Set<string>>(new Set());

  // ── Gradient speaker ──
  const gradientSpeaker = useMemo(() => {
    if (connectionState !== 'connected') return 'mello' as const;
    if (isUserSpeaking) return 'user' as const;
    return 'mello' as const;
  }, [connectionState, isUserSpeaking]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (showTranscript && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, showTranscript]);

  const handleCrisisConnect = useCallback(() => {
    callCrisisLine();
  }, []);

  // ═══════════════════════════════════════════════════
  // LIVEKIT CONNECTION
  // ═══════════════════════════════════════════════════

  const handleConnect = useCallback(async () => {
    console.log('[Hindi] Starting connection...');
    setConnectionState('connecting');
    setError(null);
    setMessages([]);
    animatedIdsRef.current.clear();
    msgIdCounter = 0;

    try {
      // Configure audio session with echo cancellation + speaker output
      await AudioSession.configureAudio({
        android: {
          // Force speaker output while keeping echo cancellation
          preferredOutputList: ['speaker'],
          audioTypeOptions: {
            manageAudioFocus: true,
            audioMode: 'inCommunication',  // Enables echo cancellation
            audioFocusMode: 'gain',
            audioStreamType: 'voiceCall',
            audioAttributesUsageType: 'voiceCommunication',
            audioAttributesContentType: 'speech',
            forceHandleAudioRouting: true,
          },
        },
        ios: {
          defaultOutput: 'speaker',
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'voiceChat',  // Enables echo cancellation on iOS
        },
      });
      await AudioSession.startAudioSession();

      // Fetch token from webapp server
      const connData: LiveKitConnectionData = await fetchLiveKitToken();
      console.log('[Hindi] Got token for room:', connData.roomName);

      // Create and configure room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        console.log('[Hindi] Room connected');
        setConnectionState('connected');
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('[Hindi] Room disconnected');
        setConnectionState('disconnected');
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('[Hindi] Participant joined:', participant.identity);
        // The Sarvam agent joins - assistant is ready
        if (participant.identity.includes('agent')) {
          const newId = `msg-${++msgIdCounter}`;
          setMessages(prev => [...prev, {
            id: newId,
            role: 'assistant',
            text: 'Namaste! Main Mello hoon. Aap kaise hain?',
          }]);
        }
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        // Handle RTVI transcript messages from the Pipecat agent
        try {
          const decoder = new TextDecoder();
          const message = JSON.parse(decoder.decode(payload));

          // RTVI format: { type: "bot-transcription", data: { text: "..." }, label: "rtvi-ai" }
          const rtviType = message.type;
          const text = message.data?.text;

          // User transcription (what the user said)
          if (rtviType === 'user-transcription' && text) {
            const newId = `msg-${++msgIdCounter}`;
            setMessages(prev => [...prev, { id: newId, role: 'user', text }]);
            setIsWaitingForResponse(true);
            setIsUserSpeaking(false);
            // Crisis detection
            if (detectCrisis(text)) {
              setShowCrisisWarning(true);
            }
          }

          // Bot transcription (full assistant message)
          if (rtviType === 'bot-transcription' && text) {
            const newId = `msg-${++msgIdCounter}`;
            setMessages(prev => [...prev, { id: newId, role: 'assistant', text }]);
            setIsWaitingForResponse(false);
          }

          // Bot started speaking
          if (rtviType === 'bot-tts-started') {
            setIsAssistantSpeaking(true);
            setIsUserSpeaking(false);
          }

          // Bot stopped speaking
          if (rtviType === 'bot-tts-stopped') {
            setIsAssistantSpeaking(false);
          }

          // User started speaking
          if (rtviType === 'user-started-speaking') {
            setIsUserSpeaking(true);
            setIsAssistantSpeaking(false);
          }

          // User stopped speaking
          if (rtviType === 'user-stopped-speaking') {
            setIsUserSpeaking(false);
          }
        } catch (e) {
          console.warn('[Hindi] Failed to parse data:', e);
        }
      });

      room.on(RoomEvent.LocalTrackPublished, () => {
        console.log('[Hindi] Local track published (mic)');
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('[Hindi] Track subscribed:', track.kind, 'from', participant.identity);
      });

      // Real-time speaking detection using LiveKit's ActiveSpeakersChanged
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const localParticipant = room.localParticipant;
        const isLocalSpeaking = speakers.some(s => s.sid === localParticipant.sid);
        const isAgentSpeaking = speakers.some(s => s.identity === 'mello-hindi-agent');

        setIsUserSpeaking(isLocalSpeaking);
        setIsAssistantSpeaking(isAgentSpeaking);
      });

      // Also listen to local participant's isSpeaking changes
      room.localParticipant.on('isSpeakingChanged', (speaking: boolean) => {
        console.log('[Hindi] Local speaking changed:', speaking);
        setIsUserSpeaking(speaking);
      });

      // Connect to room
      await room.connect(connData.serverUrl, connData.token);
      console.log('[Hindi] Room connect() completed');

      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('[Hindi] Microphone enabled');

    } catch (err) {
      console.error('[Hindi] Connection error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionState('error');
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    console.log('[Hindi] Disconnecting...');
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    await AudioSession.stopAudioSession();
    setConnectionState('disconnected');
    setIsAssistantSpeaking(false);
    setIsUserSpeaking(false);
    setIsWaitingForResponse(false);
  }, []);

  // End call and go back to voice selection
  const handleEndCall = useCallback(async () => {
    console.log('[Hindi] Ending call and going back...');
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    await AudioSession.stopAudioSession();
    onBack();
  }, [onBack]);

  const handleToggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    console.log('[Hindi] Mic muted:', newMuted);
  }, [isMuted]);

  const handleToggleTranscript = useCallback(() => {
    setShowTranscript(prev => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Sync fullscreen state to external store
  useEffect(() => {
    fullscreenStore.set(isFullscreen);
  }, [isFullscreen]);

  // Cleanup fullscreen on unmount
  useEffect(() => {
    return () => {
      fullscreenStore.set(false);
    };
  }, []);

  const handleNewCall = useCallback(() => {
    setConnectionState('idle');
    setMessages([]);
    setShowCrisisWarning(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  // ═══════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════

  const chatKeyExtractor = (item: ChatMessage) => item.id;

  const renderChatItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isNew = !animatedIdsRef.current.has(item.id);
    if (isNew) animatedIdsRef.current.add(item.id);
    return <ChatBubble item={item} isNew={isNew} />;
  }, []);

  const listFooter = useMemo(() => (
    <>
      {isWaitingForResponse && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.melloBubble, styles.typingBubble]}
        >
          <TypingIndicator color="#F9A8D472" />
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

  const renderAvatarPlaceholder = () => (
    <View style={styles.avatarContainer}>
      {connectionState === 'connected' && isAssistantSpeaking && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.speakingIndicatorRow}>
          <TypingIndicator color="#F9A8D4" />
        </Animated.View>
      )}
      <View style={styles.avatarCircle}>
        <Image
          source={require('@/assets/mello-mascot.png')}
          style={styles.mascotImage}
        />
      </View>
      {connectionState === 'connected' && (
        <Text style={styles.avatarStatusText}>
          {isAssistantSpeaking ? 'mello bol rahi hai...' :
            isUserSpeaking ? 'sun rahi hai...' :
              isMuted ? 'muted' : 'sun rahi hai...'}
        </Text>
      )}
      {connectionState === 'connecting' && (
        <>
          <ActivityIndicator size="small" color="#F9A8D4" />
          <Text style={styles.avatarStatusText}>connecting...</Text>
        </>
      )}
      {connectionState === 'disconnected' && (
        <Text style={styles.avatarStatusText}>session ended</Text>
      )}
      {connectionState === 'error' && (
        <Text style={[styles.avatarStatusText, { color: '#E53E3E' }]}>
          {error || 'Connection failed'}
        </Text>
      )}
    </View>
  );

  const renderIdleScreen = () => (
    <View style={styles.idleContainer}>
      <View style={styles.avatarCircle}>
        <Image
          source={require('@/assets/mello-mascot.png')}
          style={styles.mascotImage}
        />
      </View>
      <Text style={styles.idleTitle}>Hindi Voice Chat</Text>
      <Text style={styles.idleSubtitle}>Powered by Sarvam AI</Text>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  const isActive = connectionState === 'connected';
  const isIdle = connectionState === 'idle';
  const isEnded = connectionState === 'disconnected' || connectionState === 'error';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <MelloGradient speaker={gradientSpeaker} />

      {/* Info button — top right */}
      <Pressable style={styles.infoButton}>
        <Ionicons name="information-circle-outline" size={28} color="#9999a8" />
      </Pressable>

      {/* Back button */}
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color="#9999a8" />
      </Pressable>

      {/* Timer */}
      {isActive && (
        <CallTimer
          isActive={isActive}
          isUserSpeaking={isUserSpeaking}
          isAssistantSpeaking={isAssistantSpeaking}
        />
      )}

      {/* Content */}
      <View style={styles.contentSection}>
        {isIdle && renderIdleScreen()}
        {connectionState === 'connecting' && (
          <View style={styles.connectingContainer}>
            <View style={styles.avatarCircle}>
              <Image
                source={require('@/assets/mello-mascot.png')}
                style={styles.mascotImage}
              />
            </View>
            <ActivityIndicator size="large" color="#F9A8D4" style={{ marginTop: 20 }} />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}
        {isActive && showTranscript && (
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
        {isActive && !showTranscript && renderAvatarPlaceholder()}
        {isEnded && renderAvatarPlaceholder()}
      </View>

      {/* Controls */}
      <View style={[styles.controlsBar, { paddingBottom: 24 }]}>
        {isIdle && (
          <Pressable style={styles.startPill} onPress={handleConnect}>
            <Ionicons name="mic" size={22} color="#FFFFFF" />
            <Text style={styles.startPillText}>Start Hindi Voice</Text>
          </Pressable>
        )}

        {connectionState === 'connecting' && (
          <Pressable style={styles.connectingPill} onPress={handleDisconnect}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.connectingPillText}>Cancel</Text>
          </Pressable>
        )}

        {isActive && (
          <View style={styles.controlBar}>
            {/* Mute */}
            <Pressable
              style={[styles.controlIcon, isMuted && styles.controlIconActive]}
              onPress={handleToggleMute}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={20}
                color={isMuted ? '#E53E3E' : '#F9A8D4'}
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

            {/* End call - goes back to voice selection */}
            <Pressable style={styles.endPill} onPress={handleEndCall}>
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.endPillText}>End</Text>
            </Pressable>
          </View>
        )}

        {isEnded && (
          <Pressable style={styles.startPill} onPress={handleNewCall}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.startPillText}>New session</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  backButton: {
    position: 'absolute',
    top: 38,
    left: 8,
    padding: 8,
    zIndex: 10,
  },

  infoButton: {
    position: 'absolute',
    top: 38,
    right: 8,
    padding: 8,
    zIndex: 10,
  },

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
    backgroundColor: '#F9A8D4',
  },

  contentSection: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
  },

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
  speakingIndicatorRow: {
    marginBottom: 8,
  },

  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  connectingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectingText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  idleTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
  },
  idleSubtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
  },
  errorBox: {
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#E53E3E',
    textAlign: 'center',
  },

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
    backgroundColor: 'rgba(249, 168, 212, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 212, 0.45)',
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
