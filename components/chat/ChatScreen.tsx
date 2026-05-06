/**
 * ChatScreen — Redesigned (Claude Android–inspired)
 *
 * Layout fix: KeyboardAvoidingView wraps header + content + input so the
 * input bar rides above the keyboard on both iOS (behavior=padding) and
 * Android (behavior=height + softwareKeyboardLayoutMode=pan in app.json).
 *
 * Incognito mode: eye-off icon → temp session, nothing saved to backend.
 * Fullscreen toggle: expand-outline beside mic, uses fullscreenStore.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useSyncExternalStore,
} from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { detectCrisis, callCrisisLine } from '@/utils/crisisDetection';
import { CARD_SHADOW } from '@/components/common/LightGradient';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { fullscreenStore } from '@/utils/fullscreenStore';
import { sidebarStore } from '@/utils/sidebarStore';
import { chatNavStore } from '@/utils/chatNavStore';
import { crisisResumeStore } from '@/utils/crisisResumeStore';
import { crisisContextStore } from '@/utils/crisisContextStore';
import {
  recordCrisisFlowEvent,
  SCOPE_CRISIS_FLOW,
  clearScope,
} from '@/services/chat/liveContextInjection';
import { generateChatSuggestions } from '@/services/chat/bedrockService';
import SuggestionChips from './SuggestionChips';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TypewriterText from './TypewriterText';
import LoadingDots from './LoadingDots';
import { MicButton, RecordingBar, OnboardingModal, useVoiceMic } from './VoiceMicButton';
import FadingScrollWrapper from '@/components/get-rolling/ScrollFadeEdges';

import { sendToBedrock } from '@/services/chat/bedrockService';
import {
  createChat,
  getChats,
  getChat,
  addMessage,
  updateTitle,
  generateAndSetTitle,
  endChat,
  deleteChat,
  starChat,
  updateChatFeedback,
  toBedrockFormat,
  formatRelativeTime,
  type Chat,
  type ChatMessage,
  type ChatListItem,
  type ChatFeedback,
} from '@/services/chat/chatService';
import RenameChatSheet from './RenameChatSheet';
import SelfMindChatCrisis from './SelfMindChatCrisis';
import DeleteChatSheet from './DeleteChatSheet';
import {
  isChatSaved,
  saveChatAsEntry,
  unsaveChatEntry,
} from '@/services/journal/journalService';
import { pickChatGreetingTitle } from '@/services/chat/chatGreetingTitles';
import { pickChatGreetingChips } from '@/services/chat/chatGreetingChips';
import { getSession } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { supabase } from '@/lib/supabase';

// Re-export for sidebar
export { type ChatListItem, getChats, formatRelativeTime };

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════
// CONSTANTS / HELPERS
// ═══════════════════════════════════════════════════

/** Marketing-screenshot helper. Flip to `true` to expose a "Demo" item
 *  in the chat kebab menu that loads a canned 2-message exchange. Off
 *  in shipped builds. */
const SHOW_SCREENSHOT_DEMO = false;

/* AsyncStorage key for the chat suggestions toggle. Module-scope so
 * future call sites (settings screen, debug panel) reference the
 * same string without retyping it. Stored values:
 *   '0' — explicitly OFF (user disabled it)
 *   '1' / unset — ON (default for first-run + existing users) */
const SUGGESTIONS_STORAGE_KEY = '@selfmind:chatSuggestionsOn';

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  text: "I'm here whenever you want to talk, vent, or just think out loud — what's on your mind?",
  isUser: false,
  timestamp: new Date(),
};

function isNewMessage(id: string): boolean {
  return !id.startsWith('stored_') && id !== 'welcome';
}

function normalizeAIText(text: string): string {
  return text.replace(/^\s+/, '');
}

// ═══════════════════════════════════════════════════
// MESSAGE ITEM
// ═══════════════════════════════════════════════════

interface MessageItemProps {
  item: Message;
  isNew: boolean;
  showTypewriter: boolean;
  onTypewriterComplete: (id: string) => void;
  onCopy: (text: string) => void;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  /** Chat-level feedback. Drives the active-state of the thumbs
   *  icons under every AI bubble (the feedback applies to the chat,
   *  not per-message — same behavior the old design had). */
  feedback: ChatFeedback;
}

const ChatMessageItem = memo(function ChatMessageItem({
  item,
  isNew,
  showTypewriter,
  onTypewriterComplete,
  onCopy,
  onLike,
  onDislike,
  feedback,
}: MessageItemProps) {
  const translateX = useSharedValue(isNew ? (item.isUser ? 24 : -24) : 0);
  const opacity = useSharedValue(isNew ? 0 : 1);

  useEffect(() => {
    if (isNew) {
      translateX.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));
  const displayText = item.isUser ? item.text : normalizeAIText(item.text);

  const copyScale = useSharedValue(1);
  const likeScale = useSharedValue(1);
  const dislikeScale = useSharedValue(1);

  const tapScale = (sv: SharedValue<number>) => {
    sv.value = withTiming(0.85, { duration: 80 }, () => {
      sv.value = withTiming(1, { duration: 120 });
    });
  };

  const copyStyle = useAnimatedStyle(() => ({ transform: [{ scale: copyScale.value }] }));
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));
  const dislikeStyle = useAnimatedStyle(() => ({ transform: [{ scale: dislikeScale.value }] }));

  if (item.isUser) {
    return (
      <Animated.View style={[styles.rowUser, animStyle]}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{displayText}</Text>
        </View>
      </Animated.View>
    );
  }

  // AI bubble — MBChatMid lavender card with asymmetric top-left
  // corner. Action row sits BELOW the bubble (not inside) so it doesn't
  // clutter the rounded corner.
  return (
    <Animated.View style={[styles.rowAI, animStyle]}>
      <View style={styles.aiBubble}>
        {showTypewriter ? (
          <TypewriterText
            text={displayText}
            speed={18}
            style={styles.aiText}
            onComplete={() => onTypewriterComplete(item.id)}
          />
        ) : (
          <Text style={styles.aiText}>{displayText}</Text>
        )}
      </View>
      {!showTypewriter && (
        <View style={styles.actionRow}>
          <Animated.View style={copyStyle}>
            <Pressable style={styles.actionBtn} hitSlop={8}
              onPress={() => { tapScale(copyScale); onCopy(displayText); }}>
              <Ionicons name="copy-outline" size={15} color={C.ink3} />
            </Pressable>
          </Animated.View>
          <Animated.View style={likeStyle}>
            <Pressable style={styles.actionBtn} hitSlop={8}
              onPress={() => { tapScale(likeScale); onLike(item.id); }}>
              {feedback === 'liked'
                ? <Glyphs.ThumbUpFilled size={15} color={C.coral} />
                : <Glyphs.ThumbUp size={15} color={C.ink3} />}
            </Pressable>
          </Animated.View>
          <Animated.View style={dislikeStyle}>
            <Pressable style={styles.actionBtn} hitSlop={8}
              onPress={() => { tapScale(dislikeScale); onDislike(item.id); }}>
              {feedback === 'disliked'
                ? <Glyphs.ThumbDownFilled size={15} color={C.coral} />
                : <Glyphs.ThumbDown size={15} color={C.ink3} />}
            </Pressable>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════

interface ContextMenuProps {
  chatTitle: string;
  isStarred: boolean;
  isSavedToJournal: boolean;
  canSaveToJournal: boolean;
  /** Suggestion-chip toggle state — current value (lit when on). */
  suggestionsOn: boolean;
  onRename: () => void;
  onStar: () => void;
  onSaveToJournal: () => void;
  onDelete: () => void;
  onNewChat: () => void;
  onToggleSuggestions: () => void;
  onLoadDemo: () => void;
  onClose: () => void;
}

/**
 * Chat kebab menu — rebuilt with Claude tokens.
 *   - Card: paper + line, RADIUS.card, soft shadow.
 *   - Header block: `— this thread` kicker + Fraunces title.
 *   - Hairline divider between header and items.
 *   - Rows: label left (Inter), brand-glyph right; cream2 wash on press.
 *   - Save row's heart fills coral when saved (matches the global
 *     SavePracticeButton pattern on practice screens).
 *   - Delete row gets coral text + trash glyph.
 *   - Star row gets a filled star when starred.
 */
const ContextMenu = memo(function ContextMenu({
  chatTitle, isStarred, isSavedToJournal, canSaveToJournal, suggestionsOn,
  onRename, onStar, onSaveToJournal, onDelete, onNewChat, onToggleSuggestions, onLoadDemo, onClose,
}: ContextMenuProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 });
    translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, []);

  const menuStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.contextMenu, menuStyle]}>
        {/* Header block — kicker + chat title. Reads as a soft label,
            not a settings header. */}
        <View style={styles.contextMenuHeader}>
          <Text style={styles.contextMenuKicker}>— this thread</Text>
          <Text style={styles.contextMenuTitleNew} numberOfLines={2}>
            {chatTitle || 'New chat'}
          </Text>
        </View>

        <View style={styles.contextMenuDivider} />

        <ContextMenuItem
          icon={<Glyphs.Pencil size={17} color={C.ink2} />}
          label="Rename"
          onPress={onRename}
        />
        <ContextMenuItem
          icon={
            isStarred
              ? <Glyphs.StarFilled size={17} color={C.coral} />
              : <Glyphs.Star size={17} color={C.ink2} />
          }
          label={isStarred ? 'Starred' : 'Star'}
          onPress={onStar}
          accent={isStarred ? 'coral' : undefined}
        />
        {canSaveToJournal && (
          <ContextMenuItem
            icon={
              isSavedToJournal
                ? <Glyphs.HeartFilled size={17} color={C.coral} />
                : <Glyphs.Heart size={17} color={C.ink2} />
            }
            label={isSavedToJournal ? 'Saved to journal' : 'Save to journal'}
            onPress={onSaveToJournal}
            accent={isSavedToJournal ? 'coral' : undefined}
          />
        )}
        <ContextMenuItem
          icon={<Glyphs.Plus size={17} color={C.ink2} />}
          label="New chat"
          onPress={onNewChat}
        />
        <ContextMenuItem
          icon={
            suggestionsOn
              ? <Glyphs.Sparkle size={17} color={C.coral} />
              : <Glyphs.Sparkle size={17} color={C.ink2} />
          }
          label={suggestionsOn ? 'Suggestions on' : 'Suggestions off'}
          onPress={onToggleSuggestions}
          accent={suggestionsOn ? 'coral' : undefined}
        />
        <ContextMenuItem
          icon={<Glyphs.Trash size={17} color={C.coral} />}
          label="Delete"
          onPress={onDelete}
          danger
        />
        {SHOW_SCREENSHOT_DEMO && (
          <ContextMenuItem
            icon={<Ionicons name="camera-outline" size={17} color={C.ink2} />}
            label="Demo (for screenshot)"
            onPress={onLoadDemo}
          />
        )}
      </Animated.View>
    </>
  );
});

function ContextMenuItem({
  icon, label, onPress, danger = false, accent,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  accent?: 'coral';
}) {
  const scale = useSharedValue(1);
  const bgPressed = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: bgPressed.value > 0 ? C.cream2 : 'transparent',
  }));

  return (
    <Animated.View style={[styles.contextMenuRowWrap, animStyle]}>
      <Pressable
        style={styles.contextMenuRow}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 80 });
          bgPressed.value = withTiming(1, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
          bgPressed.value = withTiming(0, { duration: 120 });
        }}
      >
        <Text style={[
          styles.contextMenuLabel,
          danger && styles.contextMenuDanger,
          accent === 'coral' && styles.contextMenuAccentCoral,
        ]}>
          {label}
        </Text>
        {icon}
      </Pressable>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isSavedToJournal, setIsSavedToJournal] = useState(false);
  /* The persisted Chat.type for the currently-loaded thread. Used so
   * Save-to-journal records the right chat_type ('textchat' | 'voicechat')
   * — otherwise we'd always tag as 'textchat'. */
  const [chatType, setChatType] = useState<'textchat' | 'voicechat'>('textchat');
  const [refreshing, setRefreshing] = useState(false);
  /* When crisis is detected we save the user's message to the
   * conversation but DO NOT call Bedrock yet — we hold the response
   * here until the user picks Continue Chatting. View Resources
   * clears it (the user changed surfaces; no chatter at them). */
  const [pendingAI, setPendingAI] = useState<null | {
    chatId: string | null;
    conversation: ChatMessage[];
    withUser: Message[];
  }>(null);
  const [isIncognito, setIsIncognito] = useState(false);

  /* Display name for the chat agent's user-preference addendum.
   * Server-side `profiles.username` wins; falls back to local
   * onboarding `firstName`. Stored in a ref so reads at send time
   * are sync. Refreshed on focus + auth profile change. */
  const { state: authState } = useAuth();
  const userNameRef = useRef<string | null>(null);
  useEffect(() => {
    const fromProfile =
      authState.kind === 'authed' ? authState.profile?.username?.trim() ?? null : null;
    if (fromProfile) {
      userNameRef.current = fromProfile;
      return;
    }
    let cancelled = false;
    getOnboardingData()
      .then((d) => {
        if (cancelled) return;
        const local = d.firstName?.trim();
        if (local) userNameRef.current = local;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authState]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatTitle, setChatTitle] = useState('New chat');
  const [chatGreetingTitle, setChatGreetingTitle] = useState("What's floating around?");
  const [chatGreetingChips, setChatGreetingChips] = useState<string[]>([
    "i'm anxious",
    "can't sleep",
    'need to vent',
    'just checking in',
  ]);
  const [userEmail, setUserEmail] = useState('');

  /* "Suggestion on" feature: when enabled, a 2–4 chip strip of predicted
   * next user messages appears below the latest AI reply. Default ON;
   * toggle lives in the context menu (ellipsis) so users can flip it
   * mid-conversation. Persisted globally via AsyncStorage so it survives
   * across threads + app launches. Suggestions themselves are cached
   * per-message-id (latest AI message only — older replies' chips
   * become stale once the conversation moves on). */
  const [suggestionsOn, setSuggestionsOn] = useState(true);
  const [renderSuggestionsUi, setRenderSuggestionsUi] = useState(true);
  const [suggestionsByMsgId, setSuggestionsByMsgId] = useState<Record<string, string[]>>({});
  const [suggestionsLoadingFor, setSuggestionsLoadingFor] = useState<string | null>(null);
  const suggestionUiOpacity = useSharedValue(1);

  /* Restore persisted toggle on mount. Stored values:
   *   '0' → explicitly OFF (user disabled it)
   *   '1' or unset → ON (default for first-run users and existing users)
   * Failure is non-fatal — default ON stays. */
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SUGGESTIONS_STORAGE_KEY)
      .then((v) => { if (!cancelled && v === '0') setSuggestionsOn(false); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  /* Refs mirror the toggle + loading-target so `runAIStep` (which
   * runs detached) can read the latest values without depending on
   * them in its useCallback deps (which would otherwise re-bind it
   * on every state change and break the held-reply path). */
  const suggestionsOnRef = useRef(suggestionsOn);
  const suggestionsLoadingForRef = useRef<string | null>(null);
  /* AbortController for the in-flight suggestion fetch. Aborted on
   * every reset path (new send, new chat, incognito toggle, history
   * load, suggestions toggle off, unmount) so a stale Bedrock call
   * can't burn tokens for ten seconds while the user has moved on. */
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  /** Cancel the current in-flight chip fetch and clear all chip
   *  state. Safe to call repeatedly (idempotent). */
  const resetSuggestionState = useCallback(() => {
    suggestionsAbortRef.current?.abort();
    suggestionsAbortRef.current = null;
    setSuggestionsByMsgId({});
    setSuggestionsLoadingFor(null);
  }, []);
  useEffect(() => { suggestionsOnRef.current = suggestionsOn; }, [suggestionsOn]);
  useEffect(() => { suggestionsLoadingForRef.current = suggestionsLoadingFor; }, [suggestionsLoadingFor]);

  const toggleSuggestions = useCallback(() => {
    setSuggestionsOn((prev) => {
      const next = !prev;
      console.log('[ChatScreen] suggestions ' + (next ? 'ON' : 'OFF'));
      AsyncStorage.setItem(SUGGESTIONS_STORAGE_KEY, next ? '1' : '0').catch(() => { /* ignore */ });
      /* Turning off clears cache + aborts any in-flight fetch so
       * we don't render stale chips if the user flips it back on
       * later in the same thread, and we don't burn tokens on a
       * fetch the user just opted out of. */
      if (!next) resetSuggestionState();
      return next;
    });
  }, [resetSuggestionState]);

  const handleTurnOffSuggestions = useCallback(() => {
    if (suggestionsOn) toggleSuggestions();
  }, [suggestionsOn, toggleSuggestions]);

  useEffect(() => {
    if (suggestionsOn) {
      setRenderSuggestionsUi(true);
      suggestionUiOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      return;
    }

    suggestionUiOpacity.value = withTiming(
      0,
      { duration: 180, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setRenderSuggestionsUi)(false);
      },
    );
  }, [suggestionsOn, suggestionUiOpacity]);

  const suggestionFadeStyle = useAnimatedStyle(() => ({
    opacity: suggestionUiOpacity.value,
  }));

  /* Tap handler for any suggestion chip — fires send immediately
   * (no round-trip through the input pill).
   *
   * Indirection via `handleSendRef` because `handleSend` is declared
   * lower in the component body (TDZ) and we don't want to reorder
   * a 2k-line file just to satisfy declaration order. Ref is set in
   * an effect right after handleSend's definition. */
  const handleSendRef = useRef<(t?: string) => void>(() => {});
  const handlePickSuggestion = useCallback((text: string) => {
    console.log('[ChatScreen] pick suggestion → autosend · len=' + text.length);
    handleSendRef.current(text);
  }, []);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showCrisisResources, setShowCrisisResources] = useState(false);
  /* Full SelfMindChatCrisis page — shown after the user taps "View
   * Resources" on the soft inline modal. Separate state so the modal
   * can dismiss before the full page slides in. */
  const [showCrisisPage, setShowCrisisPage] = useState(false);
  const [displayedMessageIds, setDisplayedMessageIds] = useState<Set<string>>(
    new Set(['welcome'])
  );

  // Chat state - Supabase backed
  const [chatId, setChatId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [chatFeedback, setChatFeedback] = useState<ChatFeedback>(null);

  // Bottom sheet visibility
  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);
  const isFirstExchangeRef = useRef(true);

  // Refs that shadow state — used in cleanup/unmount so we always
  // see the latest values without adding them to effect deps.
  const chatIdRef = useRef<string | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const chatEndedRef = useRef(false); // prevents double-endChat calls

  // Voice mic hook
  const {
    isRecording,
    isSpeaking,
    elapsed,
    showOnboarding: showMicOnboarding,
    handleMicPress,
    handleOnboardingContinue,
    handleOnboardingClose,
    handleCancel: handleRecordingCancel,
    handleConfirm: handleRecordingConfirm,
  } = useVoiceMic((transcript) => {
    setInputText((prev) => (prev ? prev + ' ' + transcript : transcript));
  });

  // Sync fullscreen state → global store (hides tab bar)
  useEffect(() => {
    fullscreenStore.set(isFullscreen);
  }, [isFullscreen]);

  // Keep refs in sync with state (for use in cleanup without stale closures)
  useEffect(() => { chatIdRef.current = chatId; chatEndedRef.current = false; }, [chatId]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

  // Cleanup on unmount ONLY — refs hold latest values, no stale closure
  useEffect(() => {
    return () => {
      fullscreenStore.set(false);
      /* Wipe any unconsumed live-context events so a stale crisis
       * from this session can't leak into a fresh chat next launch. */
      clearScope(SCOPE_CRISIS_FLOW);
      /* Abort any in-flight suggestion-chip fetch on unmount so it
       * can't resolve into a stale setState after the screen is gone. */
      suggestionsAbortRef.current?.abort();
      suggestionsAbortRef.current = null;
      if (chatIdRef.current && conversationRef.current.length > 0 && !chatEndedRef.current) {
        chatEndedRef.current = true;
        endChat(chatIdRef.current, conversationRef.current, startTimeRef.current);
      }
    };
  }, []); // empty deps = true unmount only

  // Close sidebar + reset fullscreen when leaving the chat tab.
  // Also: if the user is returning from a crisis-side-flow (box breath
  // started from the Crisis page), re-open the Crisis page so the
  // resources are right where they left them.
  useFocusEffect(
    useCallback(() => {
      if (crisisResumeStore.consume()) {
        console.log('[ChatScreen] resuming crisis page after side-flow');
        setShowCrisisPage(true);
      }
      return () => {
        sidebarStore.close();
        setIsFullscreen(false);
        fullscreenStore.set(false);
      };
    }, [])
  );

  // Intercept Android hardware back button — exit fullscreen first, navigate second
  useEffect(() => {
    const { BackHandler } = require('react-native');
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true; // consumed — don't navigate back
      }
      return false; // let default back navigation happen
    });
    return () => sub.remove();
  }, [isFullscreen]);

  // Keep sidebar context up to date so it highlights the active session
  useEffect(() => {
    sidebarStore.setContext({ currentSessionId: chatId || '', currentTitle: chatTitle, userEmail });
  }, [chatId, chatTitle, userEmail]);

  // Sidebar nav requests — subscribe here (hooks must be unconditional/ordered)
  const pendingNav = useSyncExternalStore(chatNavStore.subscribe, chatNavStore.getSnapshot);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.id !== 'welcome'),
    [messages]
  );
  const chatState: 'greeting' | 'active' = visibleMessages.length === 0 ? 'greeting' : 'active';

  useEffect(() => {
    let cancelled = false;
    if (chatState !== 'greeting' || isIncognito) return () => { cancelled = true; };

    pickChatGreetingTitle()
      .then(async (title) => {
        const chips = await pickChatGreetingChips({ contextText: title });
        return { title, chips };
      })
      .then(({ title, chips }) => {
        if (cancelled) return;
        setChatGreetingTitle(title);
        setChatGreetingChips(chips);
      })
      .catch(() => { /* Keep the fallback title + chips. */ });

    return () => { cancelled = true; };
  }, [chatState, isIncognito]);

  // ─── Load user and most recent chat on mount ────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Get user from local session (REST auth) — fall back to supabase
        const session = await getSession();
        let userId = session?.userId || null;
        let userEmailVal = session?.email || '';

        if (!userId) {
          const { data: { user: sbUser } } = await supabase.auth.getUser();
          if (sbUser) {
            userId = sbUser.id;
            userEmailVal = sbUser.email || '';
          }
        }

        if (!userId) {
          console.log('>>> No authenticated user');
          setIsLoadingHistory(false);
          return;
        }

        userIdRef.current = userId;
        setUserEmail(userEmailVal);
        console.log('>>> User loaded:', userEmailVal, 'id=' + userId);
      } catch (err) {
        console.error('>>> Init error:', err);
        // Non-fatal
      } finally {
        setIsLoadingHistory(false);
      }
    }
    init();
  }, []);

  // ─── Auto-scroll on new messages ─────────────────
  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages, isLoading]);

  // ─── Scroll to bottom when keyboard opens ────────
  useEffect(() => {
    const { Keyboard } = require('react-native');
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  // ─── AI step (extracted) — called from handleSend in normal flow,
  //     OR from "Continue Chatting" after a crisis hold. Takes the
  //     post-user-message conversation + chatId so it works for both
  //     the immediate path and the deferred-release path. ────────
  const runAIStep = useCallback(async (
    chatIdAtSend: string | null,
    conversationAtSend: ChatMessage[],
    withUser: Message[],
    /* Optional: live-context scopes to drain into the Bedrock system
     * prompt for this single call (e.g. ['crisis-flow'] when releasing
     * a held reply after the user moved through resources / breath /
     * tell-someone). Defaults to no injection. */
    injectScopes?: string[],
  ) => {
    setIsLoading(true);
    try {
      const bedrockMessages = toBedrockFormat(conversationAtSend);
      const aiText = normalizeAIText(
        await sendToBedrock(
          bedrockMessages,
          {
            // Always pass `incognito` so user-prefs + past-session
            // memory addendums are suppressed in incognito chats.
            // This is the contract: incognito = clean slate for the
            // agent, no profile context, no past-history references.
            incognito: isIncognito,
            // Pass the user's display name through so the agent knows
            // what to call them. Skipped automatically in incognito
            // by the same gate that drops the prefs/memory addendums.
            userName: userNameRef.current,
            ...(injectScopes && injectScopes.length > 0 ? { injectScopes } : {}),
          },
        ),
      );

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([...withUser, aiMsg]);

      let nextConversation = conversationAtSend;
      if (isIncognito) {
        const aiEntry: ChatMessage = { role: 'assistant', content: aiText, timestamp: Date.now() };
        nextConversation = [...conversationAtSend, aiEntry];
        setConversation(nextConversation);
      } else if (chatIdAtSend) {
        nextConversation = await addMessage(chatIdAtSend, 'assistant', aiText, conversationAtSend);
        setConversation(nextConversation);

        if (isFirstExchangeRef.current) {
          isFirstExchangeRef.current = false;
          generateAndSetTitle(chatIdAtSend, nextConversation).then((title) => {
            console.log('>>> Title generated:', title);
            setChatTitle(title);
          });
        }
      }

      /* "Suggestion on" feature — fire next-user-message prediction
       * for THIS AI reply. Multiple safety / privacy gates:
       *
       *   1. Incognito: SKIP. Incognito's "ephemeral, nothing saved"
       *      contract means we don't make extra Bedrock calls beyond
       *      the main reply. The header subtitle accent is already
       *      suppressed in incognito; this gate stops the actual
       *      network leak.
       *   2. The service itself runs a crisis pre-gate (returns []
       *      when the latest user/AI msg is crisis-flagged) and a
       *      per-chip post-filter. We don't duplicate those here —
       *      we just trust the empty-array contract.
       *
       * Cancellation: each fetch gets its own AbortController stored
       * in `suggestionsAbortRef` so a fresh send / new-chat / toggle-
       * off / unmount can cut the in-flight call instead of letting
       * it run to its 10s timeout. */
      if (suggestionsOnRef.current && !isIncognito) {
        const targetMsgId = aiMsg.id;
        setSuggestionsLoadingFor(targetMsgId);
        /* Abort any in-flight chip request — we only care about chips
         * for the latest AI message; older ones are guaranteed-stale. */
        suggestionsAbortRef.current?.abort();
        const controller = new AbortController();
        suggestionsAbortRef.current = controller;

        const ctxMessages = toBedrockFormat([
          ...nextConversation,
        ]);
        /* Default count (3) is deterministic for QA. The model can
         * still return fewer when the moment is heavy — the system
         * prompt allows that explicitly. */
        void generateChatSuggestions(ctxMessages, { signal: controller.signal }).then((chips) => {
          if (controller.signal.aborted) return;
          if (suggestionsLoadingForRef.current !== targetMsgId) return;
          setSuggestionsByMsgId({ [targetMsgId]: chips });
          setSuggestionsLoadingFor(null);
        });
      }
    } catch (err: any) {
      console.error('>>> Send error:', err);
      setErrorText(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isIncognito]);

  // ─── Send ─────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string) => {
    /* Block sends while a crisis hold is pending — user must Continue
     * Chatting or View Resources first. Otherwise a second send could
     * race the held AI call and produce duplicate replies.
     *
     * `overrideText` lets call sites (e.g. suggestion-chip tap) send
     * immediately without round-tripping through the input pill state,
     * which is async and would race the read at line below. */
    const sourceText = overrideText ?? inputText;
    if (!sourceText.trim() || isLoading || !userIdRef.current || pendingAI) {
      console.log('[ChatScreen] handleSend bailed — input=' + sourceText.trim().length + ' isLoading=' + isLoading + ' userId=' + (userIdRef.current ? 'set' : 'null') + ' incognito=' + isIncognito + ' pendingAI=' + (pendingAI ? 'true' : 'false'));
      return;
    }

    const userText = sourceText.trim();
    console.log('[ChatScreen] handleSend → length=' + userText.length + ' incognito=' + isIncognito + ' override=' + (overrideText !== undefined));
    setInputText('');
    setErrorText(null);
    setIsMenuOpen(false);
    /* Clear stale suggestion chips AND abort any in-flight chip
     * fetch — they belonged to the previous AI reply. New chips will
     * be generated after the new AI reply lands (if the toggle is
     * on and we're not incognito). */
    resetSuggestionState();

    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      isUser: true,
      timestamp: new Date(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);

    /* Crisis detection runs FIRST — pure substring scan, no I/O,
     * fires identically for incognito and non-incognito. We then
     * persist the user message in the appropriate mode (no createChat
     * for incognito; in-memory only) and stash the post-persist state
     * in pendingAI so Continue Chatting can release the AI step. */
    const isCrisis = detectCrisis(userText);
    if (isCrisis) {
      console.log('[ChatScreen] crisis detected · incognito=' + isIncognito);
    }

    let currentChatId = chatId;
    let currentConversation = conversation;
    try {
      if (!currentChatId && !isIncognito) {
        const newChat = await createChat(userIdRef.current, 'textchat');
        if (newChat) {
          currentChatId = newChat.id;
          setChatId(newChat.id);
          setStartTime(Date.now());
          isFirstExchangeRef.current = true;
        }
      }
      if (isIncognito) {
        const userEntry: ChatMessage = { role: 'user', content: userText, timestamp: Date.now() };
        currentConversation = [...currentConversation, userEntry];
        setConversation(currentConversation);
      } else if (currentChatId) {
        currentConversation = await addMessage(currentChatId, 'user', userText, currentConversation);
        setConversation(currentConversation);
      }
    } catch (err: any) {
      console.error('>>> Send (user-step) error:', err);
      setErrorText(err.message || 'Something went wrong. Please try again.');
      /* Even if persistence threw, the crisis modal still must surface
       * — the user typed something heavy and they need the resources
       * regardless of whether the message saved. */
      if (isCrisis) {
        setPendingAI({ chatId: null, conversation: currentConversation, withUser });
        setShowCrisisResources(true);
      }
      return;
    }

    /* Crisis hold — sets pendingAI and shows the inline modal.
     * Continue Chatting → releasePendingAI → fires the AI step.
     * View Resources → keep pendingAI held through the crisis flow;
     * release on crisis-page close so Mello replies once the user is
     * back in the chat (works the same in incognito).
     * Also stash the recent conversation so /tell-someone can use it
     * as context when generating drafts. */
    if (isCrisis) {
      console.log('[ChatScreen] holding AI response · chatId=' + (currentChatId ?? 'null'));
      crisisContextStore.set(
        currentConversation.map((m) => ({ role: m.role, content: m.content })),
      );
      setPendingAI({
        chatId: currentChatId,
        conversation: currentConversation,
        withUser,
      });
      setShowCrisisResources(true);
      return;
    }

    /* Normal flow — fire the AI step now. */
    void runAIStep(currentChatId, currentConversation, withUser);
  }, [inputText, isLoading, messages, isIncognito, chatId, conversation, runAIStep, pendingAI]);

  /* Bridge `handleSend` to the ref so `handlePickSuggestion` (defined
   * higher up) can call the latest version without the TDZ. */
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  /* Release the held AI call. Drains the `crisis-flow` live-context
   * scope into the Bedrock call so the deferred reply is aware of
   * what the user just did (viewed resources, did box breath, sent a
   * tell-someone message). When the user picked Continue Chatting on
   * the inline modal, the scope is empty and injection is a no-op —
   * the call falls back to a normal reply. */
  const releasePendingAI = useCallback(() => {
    if (!pendingAI) return;
    console.log('[ChatScreen] releasing held AI response · injecting ' + SCOPE_CRISIS_FLOW);
    const { chatId: cid, conversation: conv, withUser } = pendingAI;
    setPendingAI(null);
    void runAIStep(cid, conv, withUser, [SCOPE_CRISIS_FLOW]);
  }, [pendingAI, runAIStep]);

  // ─── Finalize current chat (guarded — never fires twice) ────────────
  const finalizeCurrentChat = useCallback(() => {
    if (chatIdRef.current && conversationRef.current.length > 0 && !chatEndedRef.current) {
      chatEndedRef.current = true;
      endChat(chatIdRef.current, conversationRef.current, startTimeRef.current);
    }
  }, []);

  // ─── Sidebar ──────────────────────────────────────
  const handleSelectSession = useCallback(async (session: ChatListItem) => {
    console.log('>>> Loading chat:', session.id);
    sidebarStore.close();

    finalizeCurrentChat();

    // Load selected chat
    const loadedChat = await getChat(session.id);
    if (loadedChat) {
      setChatId(loadedChat.id);
      setChatTitle(loadedChat.title || 'New chat');
      setConversation(loadedChat.conversation || []);
      setStartTime(loadedChat.start_time || Date.now());
      setIsStarred(!!(loadedChat as any).is_starred);
      setChatFeedback((loadedChat as any).feedback ?? null);
      setChatType(loadedChat.type === 'voicechat' ? 'voicechat' : 'textchat');
      isFirstExchangeRef.current = (loadedChat.conversation || []).length === 0;

      // Fire-and-forget: ask the journal whether this chat is currently saved.
      // Header subtitle + context-menu label depend on this.
      isChatSaved(loadedChat.id)
        .then((saved) => {
          console.log('[ChatScreen] isChatSaved(' + loadedChat.id + ') = ' + saved);
          setIsSavedToJournal(saved);
        })
        .catch((err) => console.warn('[ChatScreen] isChatSaved failed', err));

      // Convert to display format
      const restored: Message[] = (loadedChat.conversation || []).map((m, idx) => ({
        id: `restored_${idx}`,
        text: m.content,
        isUser: m.role === 'user',
        timestamp: new Date(m.timestamp),
      }));
      setMessages([WELCOME_MESSAGE, ...restored]);
      setDisplayedMessageIds(new Set(['welcome', ...restored.map((m) => m.id)]));
      /* Restored chat = no in-flight chip fetch is still relevant.
       * Abort any pending one and clear cached chips from the prior
       * thread so they don't briefly appear under restored AI msgs. */
      resetSuggestionState();
    }
  }, [finalizeCurrentChat, resetSuggestionState]);

  // ─── Incognito content fade ───────────────────────
  const contentOpacity = useSharedValue(1);
  const contentAnimStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const fadeSwitchMode = useCallback((action: () => void) => {
    contentOpacity.value = withTiming(0, { duration: 100, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(action)();
    });
  }, []);

  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [isIncognito]);

  const handleStartIncognito = useCallback(() => {
    finalizeCurrentChat();
    setIsIncognito(true);
    setChatId(null);
    setConversation([]);
    setMessages([WELCOME_MESSAGE]);
    setDisplayedMessageIds(new Set(['welcome']));
    setChatTitle('Incognito chat');
    setIsMenuOpen(false);
    /* Cancel any in-flight chip fetch from the prior (non-incognito)
     * thread so it can't resolve into the new incognito surface. */
    resetSuggestionState();
  }, [finalizeCurrentChat, resetSuggestionState]);

  const handleExitIncognito = useCallback(() => {
    setIsIncognito(false);
    setChatId(null);
    setConversation([]);
    setMessages([WELCOME_MESSAGE]);
    setDisplayedMessageIds(new Set(['welcome']));
    setChatTitle('New chat');
    isFirstExchangeRef.current = true;
    resetSuggestionState();
  }, [resetSuggestionState]);

  // ─── Message actions ──────────────────────────────
  const handleTypewriterComplete = useCallback((id: string) => {
    setDisplayedMessageIds((prev) => new Set(prev).add(id));
  }, []);

  const handleCopy = useCallback((text: string) => {
    Share.share({ message: text });
  }, []);

  const handleLike = useCallback((_id: string) => {
    if (!chatId) return;
    const next: ChatFeedback = chatFeedback === 'liked' ? null : 'liked';
    setChatFeedback(next);
    updateChatFeedback(chatId, next);
  }, [chatId, chatFeedback]);

  const handleDislike = useCallback((_id: string) => {
    if (!chatId) return;
    const next: ChatFeedback = chatFeedback === 'disliked' ? null : 'disliked';
    setChatFeedback(next);
    updateChatFeedback(chatId, next);
  }, [chatId, chatFeedback]);

  // ─── Context menu ─────────────────────────────────
  const handleRename = useCallback(() => {
    setIsMenuOpen(false);
    setShowRenameSheet(true);
  }, []);

  const handleRenameSave = useCallback(async (newTitle: string) => {
    setChatTitle(newTitle);
    if (!chatId) return;
    await updateTitle(chatId, newTitle);
    // Keep the saved-journal entry in sync. The partial UNIQUE on
    // (user_id, chat_id) WHERE source='chat' makes this an upsert that
    // overwrites the entry's title in place — no duplicate rows.
    if (isSavedToJournal) {
      try {
        await saveChatAsEntry({ chatId, title: newTitle, chatType });
      } catch (err) {
        console.warn('[ChatScreen] rename: journal-entry sync failed', err);
      }
    }
  }, [chatId, chatType, isSavedToJournal]);

  const handleNewChat = useCallback(() => {
    console.log('>>> Starting new chat');
    finalizeCurrentChat();
    setIsMenuOpen(false);
    setIsIncognito(false);
    setChatId(null);
    setConversation([]);
    setMessages([WELCOME_MESSAGE]);
    setDisplayedMessageIds(new Set(['welcome']));
    setChatTitle('New chat');
    setIsStarred(false);
    setIsSavedToJournal(false);
    setChatType('textchat');
    setErrorText(null);
    setStartTime(Date.now());
    isFirstExchangeRef.current = true;
    sidebarStore.close();
    resetSuggestionState();
  }, [finalizeCurrentChat, resetSuggestionState]);

  useEffect(() => {
    if (!pendingNav) return;
    chatNavStore.clear();
    if (pendingNav.type === 'new-chat') {
      handleNewChat();
    } else if (pendingNav.type === 'select-session') {
      handleSelectSession(pendingNav.session);
    }
  }, [pendingNav, handleNewChat, handleSelectSession]);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setShowDeleteSheet(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    // If this chat had a journal entry, drop it too — orphans cause
    // "saved chat" tags pointing at deleted threads.
    if (chatId) {
      await deleteChat(chatId);
      try { await unsaveChatEntry(chatId); } catch (err) {
        console.warn('[ChatScreen] unsave-on-delete failed', err);
      }
    }
    setChatId(null);
    setConversation([]);
    setMessages([WELCOME_MESSAGE]);
    setDisplayedMessageIds(new Set(['welcome']));
    setChatTitle('New chat');
    setIsStarred(false);
    setIsSavedToJournal(false);
    setChatType('textchat');
    setChatFeedback(null);
    setStartTime(Date.now());
    isFirstExchangeRef.current = true;
    resetSuggestionState();
  }, [chatId, resetSuggestionState]);

  /* Marketing demo — populates the chat with a single canned exchange
   * for screenshots. Doesn't touch the backend (no createChat / addMessage)
   * so it leaves no trace. Reachable from the kebab → "Demo" item; the
   * menu closes before render so it won't appear in the screenshot. */
  const handleLoadDemo = useCallback(() => {
    setIsMenuOpen(false);
    const baseTs = Date.now();
    const demoMessages: Message[] = [
      {
        id: 'demo-user',
        text: 'I can’t sleep... my thoughts just won’t stop tonight.',
        isUser: true,
        timestamp: new Date(baseTs),
      },
      {
        id: 'demo-ai',
        text: 'I hear you. It’s okay to feel overwhelmed. Would you like to try a breathing exercise, or just talk?',
        isUser: false,
        timestamp: new Date(baseTs + 1500),
      },
    ];
    setMessages([WELCOME_MESSAGE, ...demoMessages]);
    setDisplayedMessageIds(new Set(['welcome', 'demo-user', 'demo-ai']));
    setChatTitle('Late-night thoughts');
  }, []);

  const handleStar = useCallback(() => {
    setIsMenuOpen(false);
    const next = !isStarred;
    setIsStarred(next);
    if (chatId) starChat(chatId, next);
  }, [chatId, isStarred]);

  const handleSaveToJournal = useCallback(async () => {
    setIsMenuOpen(false);
    if (!chatId) {
      console.warn('[ChatScreen] save-to-journal: no chatId yet (greeting state)');
      return;
    }
    if (isIncognito) {
      console.warn('[ChatScreen] save-to-journal blocked in incognito');
      return;
    }
    const next = !isSavedToJournal;
    console.log('[ChatScreen] save→journal next=' + next + ' chatId=' + chatId);
    // Optimistic flip — UI reflects immediately; rollback if request fails.
    setIsSavedToJournal(next);
    const result = next
      ? await saveChatAsEntry({ chatId, title: chatTitle, chatType })
      : await unsaveChatEntry(chatId);
    if (!result.ok) {
      console.warn('[ChatScreen] save-to-journal failed, rolling back:', result.error);
      setIsSavedToJournal(!next);
    }
  }, [chatId, chatTitle, chatType, isIncognito, isSavedToJournal]);

  // ─── Pull-to-refresh — refetch the current chat from the server ──
  const handleRefresh = useCallback(async () => {
    if (!chatId) return;
    console.log('[ChatScreen] pull-to-refresh chatId=' + chatId);
    setRefreshing(true);
    try {
      const fresh = await getChat(chatId);
      if (fresh) {
        setConversation(fresh.conversation || []);
        setChatTitle(fresh.title || 'New chat');
        setIsStarred(!!(fresh as any).is_starred);
        setChatFeedback((fresh as any).feedback ?? null);
        const restored: Message[] = (fresh.conversation || []).map((m, idx) => ({
          id: `restored_${idx}`,
          text: m.content,
          isUser: m.role === 'user',
          timestamp: new Date(m.timestamp),
        }));
        setMessages([WELCOME_MESSAGE, ...restored]);
        setDisplayedMessageIds(new Set(['welcome', ...restored.map((m) => m.id)]));
      }
    } finally {
      setRefreshing(false);
    }
  }, [chatId]);

  /* Last AI message id — chips only render under THIS message so
   * older replies stay clean as the conversation moves on. */
  const latestAiMessageId = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (!visibleMessages[i].isUser) return visibleMessages[i].id;
    }
    return null;
  }, [visibleMessages]);

  // ─── Render message ───────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    if (item.id === 'welcome') return null;
    const isLatestAi = !item.isUser && item.id === latestAiMessageId;
    const chipsForThis = suggestionsByMsgId[item.id];
    const isLoadingChips = suggestionsOn && isLatestAi && suggestionsLoadingFor === item.id;
    /* Don't render chips while the typewriter is still animating —
     * it'd shift the layout mid-reveal and feel jumpy. */
    const typewriterPending = !item.isUser && !displayedMessageIds.has(item.id);
    /* Chip row visibility — every gate is load-bearing:
     *   - suggestionsOn: user toggle (default on, off-able from menu)
     *   - !isIncognito:  incognito mode disables the feature entirely
     *                    (no UI, on top of the runAIStep network gate)
     *   - isLatestAi:    chips only attach to the most recent AI bubble
     *   - !typewriterPending: don't pop chips mid-reveal (layout shift)
     *   - loading || chips: skip empty state silently */
    const showChipRow =
      suggestionsOn &&
      !isIncognito &&
      isLatestAi &&
      !typewriterPending &&
      (isLoadingChips || (chipsForThis && chipsForThis.length > 0));

    return (
      <View>
        <ChatMessageItem
          item={item}
          isNew={isNewMessage(item.id)}
          showTypewriter={!item.isUser && !displayedMessageIds.has(item.id)}
          onTypewriterComplete={handleTypewriterComplete}
          onCopy={handleCopy}
          onLike={handleLike}
          onDislike={handleDislike}
          feedback={chatFeedback}
        />
        {showChipRow && (
          <View style={styles.suggestionRowWrap}>
            <SuggestionChips
              chips={chipsForThis ?? []}
              onPick={handlePickSuggestion}
              loading={isLoadingChips}
            />
          </View>
        )}
      </View>
    );
  }, [
    displayedMessageIds, handleTypewriterComplete, handleCopy, handleLike, handleDislike,
    chatFeedback, latestAiMessageId, suggestionsByMsgId, suggestionsOn, isIncognito,
    suggestionsLoadingFor, handlePickSuggestion,
  ]);

  const renderFooter = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.rowAI}>
          <View style={styles.aiContent}>
            <LoadingDots color={C.ink3} dotSize={7} />
          </View>
        </View>
      );
    }
    if (errorText) {
      return (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{errorText}</Text>
          <Pressable onPress={() => setErrorText(null)} hitSlop={8}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  }, [isLoading, errorText]);

  // ─── Header subtitle slide-up ─────────────────────
  const SUBTITLE_H = 16;
  const subtitleVisible = true; // Always show subtitle
  const subtitleH = useSharedValue(subtitleVisible ? SUBTITLE_H : 0);
  const subtitleOpacity = useSharedValue(subtitleVisible ? 1 : 0);

  useEffect(() => {
    if (subtitleVisible) {
      subtitleH.value = withTiming(SUBTITLE_H, { duration: 200, easing: Easing.out(Easing.quad) });
      subtitleOpacity.value = withTiming(1, { duration: 200 });
    } else {
      subtitleH.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) });
      subtitleOpacity.value = withTiming(0, { duration: 120 });
    }
  }, [subtitleVisible]);

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    height: subtitleH.value,
    opacity: subtitleOpacity.value,
    overflow: 'hidden',
  }));

  const [inputFocused, setInputFocused] = useState(false);

  // (fullscreen button removed — replaced by voice mode button)

  // ─── Send button scale ────────────────────────────
  const sendScale = useSharedValue(1);
  const sendScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  const handleSendPress = useCallback(() => {
    console.log('[ChatScreen] sendBtn tapped → inputText.len=' + inputText.trim().length + ' isLoading=' + isLoading + ' isLoadingHistory=' + isLoadingHistory + ' userId=' + userIdRef.current);
    sendScale.value = withTiming(0.88, { duration: 80 }, () => {
      sendScale.value = withTiming(1, { duration: 120 });
    });
    handleSend();
  }, [handleSend, inputText, isLoading, isLoadingHistory]);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  const paddingTop = insets.top + 12;
  const headerSubtitleText = isIncognito ? 'Incognito chat' : 'text chat';

  return (
    <View style={styles.root}>
      {/* ── Mic onboarding modal ── */}
      <OnboardingModal
        visible={showMicOnboarding}
        onContinue={handleOnboardingContinue}
        onClose={handleOnboardingClose}
      />

      {/* ── Bottom sheets ── */}
      <RenameChatSheet
        visible={showRenameSheet}
        currentTitle={chatTitle}
        onClose={() => setShowRenameSheet(false)}
        onSave={handleRenameSave}
      />
      <DeleteChatSheet
        visible={showDeleteSheet}
        chatTitle={chatTitle}
        onClose={() => setShowDeleteSheet(false)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Context menu overlay */}
      {isMenuOpen && (
        <View style={styles.menuOverlay} pointerEvents="box-none">
          <ContextMenu
            chatTitle={chatTitle}
            isStarred={isStarred}
            isSavedToJournal={isSavedToJournal}
            canSaveToJournal={!isIncognito && !!chatId}
            suggestionsOn={suggestionsOn}
            onRename={handleRename}
            onStar={handleStar}
            onSaveToJournal={handleSaveToJournal}
            onDelete={handleDelete}
            onNewChat={handleNewChat}
            onToggleSuggestions={() => {
              toggleSuggestions();
              setIsMenuOpen(false);
            }}
            onLoadDemo={handleLoadDemo}
            onClose={() => setIsMenuOpen(false)}
          />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header (MBChatMid port — non-incognito + incognito) ──
            Both modes use the SelfMind chrome (back chevron · avatar +
            title + mono subtitle · right action). The avatar swatch +
            glyph + subtitle copy are the only visible differences:
              regular   — peach swatch + Sparkle  + "a quiet new thread" / "saved to journal"
              incognito — cream2 swatch + EyeShut + "nothing saved · ephemeral"
            Right action:
              regular greeting — eye-off (enter incognito)
              regular active   — ellipsis (context menu)
              incognito        — close X (exit incognito) */}
        <View style={[styles.header, { paddingTop }]}>
          <Pressable
            style={styles.headerBtn}
            hitSlop={8}
            onPress={() => {
              console.log('[ChatScreen] back tapped → /chats');
              router.push('/chats' as any);
            }}
          >
            <Glyphs.Back size={20} color={C.ink} />
          </Pressable>

          <View style={styles.headerActiveCenter}>
            <View
              style={[
                styles.headerAvatar,
                isIncognito && styles.headerAvatarIncognito,
              ]}
            >
              {isIncognito ? (
                <Glyphs.EyeShut size={16} color={C.ink} />
              ) : (
                <Glyphs.Sparkle size={16} color={C.ink} />
              )}
            </View>
            <View style={styles.headerActiveText}>
              <Text style={styles.headerActiveTitle} numberOfLines={1}>
                {isIncognito
                  ? 'Incognito'
                  : (chatTitle || 'New chat')}
              </Text>
              <Text style={styles.headerActiveSubtitle}>
                {isIncognito
                  ? 'nothing saved · ephemeral'
                  : isSavedToJournal
                    ? 'saved to journal'
                    : isStarred
                      ? 'starred'
                      : chatState === 'active'
                        ? 'text chat'
                        : 'a quiet new thread'}
              </Text>
              {!isIncognito && renderSuggestionsUi && (
                <Animated.Text
                  style={[styles.headerSuggestionsLine, styles.headerActiveSubtitleAccent, suggestionFadeStyle]}
                  onPress={handleTurnOffSuggestions}
                  suppressHighlighting
                >
                  suggestions on
                </Animated.Text>
              )}
              {!isIncognito && !renderSuggestionsUi && (
                <Text
                  style={[styles.headerSuggestionsLine, styles.headerActiveSubtitleAction]}
                  onPress={toggleSuggestions}
                  suppressHighlighting
                >
                  turn on suggestions
                </Text>
              )}
            </View>
          </View>

          {isIncognito ? (
            <Pressable
              style={styles.headerBtn}
              hitSlop={8}
              onPress={() => {
                console.log('[ChatScreen] close (X) tapped → exit incognito');
                fadeSwitchMode(handleExitIncognito);
              }}
            >
              <Glyphs.Close size={20} color={C.ink} />
            </Pressable>
          ) : chatState === 'active' ? (
            <Pressable
              style={styles.headerBtn}
              hitSlop={8}
              onPress={() => {
                console.log('[ChatScreen] ellipsis tapped → toggle context menu');
                setIsMenuOpen((v) => !v);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={C.ink} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.headerBtn}
              hitSlop={8}
              onPress={() => {
                console.log('[ChatScreen] eye-off tapped (greeting) → start incognito');
                fadeSwitchMode(handleStartIncognito);
              }}
            >
              <Glyphs.EyeShut size={20} color={C.ink} />
            </Pressable>
          )}
        </View>

        {/* ── Content ── */}
        <Animated.View style={[styles.flex, contentAnimStyle]}>
          {isIncognito && chatState === 'greeting' ? (
            <View style={styles.greetingContainer}>
              <View style={styles.incognitoBadge}>
                <Glyphs.EyeShut size={32} color={C.ink} />
              </View>
              <Text style={styles.greetingKicker}>OFF THE RECORD</Text>
              <Text style={styles.greetingText}>
                Talk{' '}
                <Text style={styles.greetingTextItalic}>without footprints</Text>.
              </Text>
              <Text style={styles.greetingHint}>
                This thread won{'’'}t be saved, won{'’'}t shape your profile, and disappears the moment you tap close. Type anything.
              </Text>
            </View>
          ) : chatState === 'greeting' ? (
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingKicker}>A QUIET ROOM</Text>
              <Text style={styles.greetingText}>
                {chatGreetingTitle}
              </Text>
              <Text style={styles.greetingHint}>
                Type below — out loud or in fragments. Whatever shape it{'’'}s in.
              </Text>

              {/* Preset opener chips — give the user a one-tap on-ramp
               * when they don't know how to start. Tapping fills the
               * input pill (per product spec) so they can edit before
               * sending. Hidden when the toggle is off. */}
              {renderSuggestionsUi && (
                <Animated.View style={[styles.greetingChipsWrap, suggestionFadeStyle]}>
                  <SuggestionChips
                    chips={chatGreetingChips}
                    onPick={handlePickSuggestion}
                    ariaLabel="Conversation openers"
                    align="center"
                  />
                </Animated.View>
              )}
            </View>
          ) : (
            <FadingScrollWrapper topFadeHeight={32} bottomFadeHeight={48}>
              <FlatList
                ref={flatListRef}
                data={visibleMessages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={renderFooter}
                removeClippedSubviews={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={C.ink2}
                    colors={[C.coral]}
                    progressBackgroundColor={C.paper}
                  />
                }
              />
            </FadingScrollWrapper>
          )}
        </Animated.View>

        {/* ── Input bar ── */}
        <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          {isRecording ? (
            <RecordingBar
              elapsed={elapsed}
              isSpeaking={isSpeaking}
              onCancel={handleRecordingCancel}
              onConfirm={handleRecordingConfirm}
            />
          ) : (
            <View style={[
              styles.inputPill,
              inputFocused && styles.inputPillFocused,
              isIncognito && styles.inputPillIncognito,
            ]}>
              <TextInput
                style={styles.input}
                placeholder={
                  isLoading ? 'thinking…'
                  : chatState === 'active' ? 'Reply…'
                  : 'Type to start a thread…'
                }
                placeholderTextColor={C.ink3}
                value={inputText}
                onChangeText={setInputText}
                editable={!isLoading && !isLoadingHistory}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                multiline
                blurOnSubmit={false}
                returnKeyType="send"
                onSubmitEditing={handleSendPress}
              />

              <View style={styles.inputButtonRow}>
                {inputText.trim() ? (
                  <View style={styles.buttonContainer}>
                    <View style={styles.micButtonPlaceholder} />
                    
                    <Animated.View style={sendScaleStyle}>
                      <Pressable
                        style={styles.sendBtn}
                        onPress={handleSendPress}
                        disabled={isLoading || isLoadingHistory}
                      >
                        <Ionicons name="arrow-up" size={20} color={C.cream} />
                      </Pressable>
                    </Animated.View>
                  </View>
                ) : (
                  <View style={styles.buttonContainer}>
                    <MicButton onPress={handleMicPress} />
                    
                    {/* Voice mode button — navigates to voice chat tab (hidden when typing) */}
                    <Pressable
                      style={styles.voiceModeBtn}
                      onPress={() => router.navigate('/(main)/call' as any)}
                      hitSlop={6}
                    >
                      <View style={styles.voiceWaveform}>
                        <View style={[styles.voiceBar, styles.voiceBarShort]} />
                        <View style={[styles.voiceBar, styles.voiceBarTall]} />
                        <View style={[styles.voiceBar, styles.voiceBarPeak]} />
                        <View style={[styles.voiceBar, styles.voiceBarTall]} />
                        <View style={[styles.voiceBar, styles.voiceBarShort]} />
                      </View>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Crisis quick-prompt (inline soft modal) ── */}
      {showCrisisResources && (
        <View style={styles.crisisOverlay}>
          <View style={styles.crisisCard}>
            <Text style={styles.crisisTitle}>A pause for a moment</Text>
            <Text style={styles.crisisText}>
              It sounds like you might be going through something difficult.
              Would you like to see some resources that can help?
            </Text>
            <Pressable
              style={styles.crisisBtn}
              onPress={() => {
                /* User chose resources — close the inline prompt and
                 * open the full crisis page. We KEEP the pending AI
                 * call held while they're on the crisis page or in any
                 * side-flow (no chatter during a heavy moment). It
                 * fires when the user closes the crisis overlay back
                 * to chat. The recorded event feeds liveContextInjection
                 * so Mello's deferred reply knows what they did. */
                recordCrisisFlowEvent('viewed-resources');
                setShowCrisisResources(false);
                setShowCrisisPage(true);
              }}
            >
              <Text style={styles.crisisBtnText}>View Resources</Text>
            </Pressable>
            <Pressable
              style={styles.crisisDismiss}
              onPress={() => {
                /* User chose to keep chatting — close the prompt and
                 * release the held AI call so Mello replies now. */
                setShowCrisisResources(false);
                releasePendingAI();
              }}
            >
              <Text style={styles.crisisDismissText}>Continue Chatting</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Full crisis page — Indian helplines + tell-someone CTA ──
       * Rendered as an in-tree absolute overlay (NOT a native Modal)
       * so the navigation stack can slide a side-flow on top of it
       * without a chat-flash. On close we release any held AI reply
       * — the crisis pause is over, Mello can speak again. Same
       * release path applies to incognito (pendingAI is set the same
       * way regardless of mode). */}
      <SelfMindChatCrisis
        visible={showCrisisPage}
        onClose={() => {
          setShowCrisisPage(false);
          releasePendingAI();
        }}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  flex: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logoText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  headerSubtitle: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.ink3,
    marginTop: 4,
  },

  // Active-chat header (MBChatMid layout)
  headerActiveCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.peach,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  /* Incognito avatar — cream2 swatch with a dashed ink border so the
   * eye-shut glyph reads as "muted / private" rather than warm. The
   * dashed stroke echoes the input pill's incognito treatment. */
  headerAvatarIncognito: {
    backgroundColor: C.cream2,
    borderWidth: 1,
    borderColor: C.ink2,
    borderStyle: 'dashed',
  },
  headerActiveText: { flex: 1 },
  headerActiveTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.05,
    color: C.ink,
  },
  headerActiveSubtitle: {
    marginTop: 2,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.ink3,
  },
  headerSuggestionsLine: {
    marginTop: 2,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  /* Highlighted accent color for the "suggestions on" status — same
   * mono cut + size, deeper lavender so the on-state reads at a glance
   * without competing with the chat title above. */
  headerActiveSubtitleAccent: {
    color: C.lavenderDeep,
  },
  headerActiveSubtitleAction: {
    color: C.ink3,
    opacity: 0.72,
  },

  // ── Context Menu ──
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingRight: 12,
  },
  contextMenu: {
    backgroundColor: C.paper,
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minWidth: 240,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 12,
  },
  contextMenuHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  contextMenuKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  contextMenuTitleNew: {
    marginTop: 4,
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  contextMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  contextMenuRowWrap: {
    borderRadius: 14,
    marginHorizontal: 2,
    marginVertical: 1,
    overflow: 'hidden',
  },
  contextMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  contextMenuLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.05,
  },
  contextMenuDanger: { color: C.coral },
  contextMenuAccentCoral: { color: C.coral },

  // ── Greeting ──
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  greetingKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    marginBottom: 14,
  },
  greetingTextItalic: { fontFamily: 'Fraunces-MediumItalic' },
  greetingHint: {
    marginTop: 16,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: C.ink3,
    textAlign: 'center',
    maxWidth: 280,
    letterSpacing: 0.1,
  },
  greetingText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 30,
    color: C.ink,
    lineHeight: 38,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  greetingChipsWrap: {
    marginTop: 28,
    width: '100%',
    /* Center the wrapped pill row under the greeting copy. */
    alignItems: 'center',
  },
  /* Wrapper for per-message suggestion chips — left-aligned to the
   * AI message column, with a small gap below the bubble. */
  suggestionRowWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    marginBottom: 8,
  },

  // ── Incognito empty state ──
  /* Soft cream2 circle with a dashed ink border housing the EyeShut
   * glyph — visually echoes the header avatar's incognito variant. */
  incognitoBadge: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.cream2,
    borderWidth: 1,
    borderColor: C.ink2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  incognitoIcon: {
    marginBottom: 20,
    opacity: 0.7,
  },
  incognitoTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    color: C.ink,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  incognitoSubtitle: {
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    color: C.ink2,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // ── Messages (MBChatMid styling) ──
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  rowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  userBubble: {
    // Ink bubble, cream text, asymmetric top-right corner.
    backgroundColor: C.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '84%',
    borderRadius: 20,
    borderTopRightRadius: 6,
  },
  userText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: C.cream,
    lineHeight: 20,
    letterSpacing: 0.05,
  },
  rowAI: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  // Lavender bubble, ink text, asymmetric top-left corner.
  aiBubble: {
    backgroundColor: C.lavender,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '84%',
    borderRadius: 20,
    borderTopLeftRadius: 6,
  },
  // Legacy alias kept for any external reference; not used in render.
  aiContent: {
    maxWidth: '85%',
    paddingRight: 8,
  },
  aiText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    color: C.ink,
    lineHeight: 24,
    letterSpacing: -0.05,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 6,
    gap: 4,
  },
  actionBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  // ── Error ──
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  errorText: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13,
    color: C.coral,
    flex: 1,
    textAlign: 'center',
  },
  errorDismiss: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.4,
    color: C.ink3,
  },

  // ── Input ──
  inputWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputPill: {
    backgroundColor: C.paper,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: C.line,
  },
  inputPillFocused: {
    borderColor: C.line2,
  },
  inputPillIncognito: {
    borderStyle: 'dashed',
    borderColor: 'rgba(26,31,54,0.2)',
  },
  input: {
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    color: C.ink,
    lineHeight: 22,
    minHeight: 22,
    maxHeight: 110,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: 'top',
    letterSpacing: 0.1,
  },
  inputButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 10,
  },
  buttonContainer: {
    width: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  micButtonPlaceholder: {
    width: 48,
    height: 54,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceModeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
  },
  voiceDot: {
    width: 2.5,
    height: 4,
    borderRadius: 1.25,
    backgroundColor: C.cream,
    opacity: 0.92,
  },
  voiceBar: {
    width: 2.5,
    borderRadius: 1.25,
    backgroundColor: C.cream,
  },
  voiceBarShort: {
    height: 5,
  },
  voiceBarTall: {
    height: 11,
  },
  voiceBarPeak: {
    height: 14,
  },

  // ── Crisis modal ──
  crisisOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26,31,54,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 20,
  },
  crisisCard: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  crisisTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    color: C.ink,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  crisisText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    color: C.ink2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    letterSpacing: 0.1,
  },
  crisisBtn: {
    backgroundColor: C.ink,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS.btn,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  crisisBtnText: {
    fontFamily: 'Inter-Medium',
    color: C.cream,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  crisisDismiss: { paddingVertical: 12 },
  crisisDismissText: {
    fontFamily: 'JetBrainsMono-Medium',
    color: C.ink3,
    fontSize: 11,
    letterSpacing: 1.4,
  },
});
