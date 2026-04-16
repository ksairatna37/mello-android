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
import { fullscreenStore } from '@/utils/fullscreenStore';
import { sidebarStore } from '@/utils/sidebarStore';
import { chatNavStore } from '@/utils/chatNavStore';
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
import DeleteChatSheet from './DeleteChatSheet';
import { getSession } from '@/services/auth';
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

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  text: "Hey! I'm Mello. I'm here whenever you want to talk, vent, or just think out loud. What's on your mind?",
  isUser: false,
  timestamp: new Date(),
};

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'this morning?';
  if (h >= 12 && h < 17) return 'this afternoon?';
  if (h >= 17 && h < 21) return 'this evening?';
  return 'tonight?';
}


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
}

const ChatMessageItem = memo(function ChatMessageItem({
  item,
  isNew,
  showTypewriter,
  onTypewriterComplete,
  onCopy,
  onLike,
  onDislike,
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

  return (
    <Animated.View style={[styles.rowAI, animStyle]}>
      <View style={styles.aiContent}>
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
        {!showTypewriter && (
          <View style={styles.actionRow}>
            <Animated.View style={copyStyle}>
              <Pressable style={styles.actionBtn} hitSlop={8}
                onPress={() => { tapScale(copyScale); onCopy(displayText); }}>
                <Ionicons name="copy-outline" size={15} color="rgba(0,0,0,0.35)" />
              </Pressable>
            </Animated.View>
            <Animated.View style={likeStyle}>
              <Pressable style={styles.actionBtn} hitSlop={8}
                onPress={() => { tapScale(likeScale); onLike(item.id); }}>
                <Ionicons name="thumbs-up-outline" size={15} color="rgba(0,0,0,0.35)" />
              </Pressable>
            </Animated.View>
            <Animated.View style={dislikeStyle}>
              <Pressable style={styles.actionBtn} hitSlop={8}
                onPress={() => { tapScale(dislikeScale); onDislike(item.id); }}>
                <Ionicons name="thumbs-down-outline" size={15} color="rgba(0,0,0,0.35)" />
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════

interface ContextMenuProps {
  chatTitle: string;
  isStarred: boolean;
  onRename: () => void;
  onStar: () => void;
  onDelete: () => void;
  onNewChat: () => void;
  onClose: () => void;
}

const ContextMenu = memo(function ContextMenu({
  chatTitle, isStarred, onRename, onStar, onDelete, onNewChat, onClose,
}: ContextMenuProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 160 });
    translateY.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
  }, []);

  const menuStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.contextMenu, menuStyle]}>
        <Text style={styles.contextMenuTitle}>{chatTitle}</Text>
        <View style={styles.contextMenuDivider} />
        <ContextMenuItem icon="pencil-outline" label="Rename" onPress={onRename} />
        <ContextMenuItem icon={isStarred ? 'star' : 'star-outline'} label={isStarred ? 'Starred' : 'Star'} onPress={onStar} />
        <ContextMenuItem icon="home-outline" label="Add to home" onPress={() => {}} />
        <ContextMenuItem icon="trash-outline" label="Delete" onPress={onDelete} danger />
        <ContextMenuItem icon="add-circle-outline" label="New chat" onPress={onNewChat} />
      </Animated.View>
    </>
  );
});

function ContextMenuItem({
  icon, label, onPress, danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.contextMenuRow}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 80 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
      >
        <Text style={[styles.contextMenuLabel, danger && styles.contextMenuDanger]}>{label}</Text>
        <Ionicons name={icon} size={18} color={danger ? '#EF4444' : 'rgba(0,0,0,0.5)'} />
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
  const [isIncognito, setIsIncognito] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatTitle, setChatTitle] = useState('New chat');
  const [userEmail, setUserEmail] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showCrisisResources, setShowCrisisResources] = useState(false);
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
      if (chatIdRef.current && conversationRef.current.length > 0 && !chatEndedRef.current) {
        chatEndedRef.current = true;
        endChat(chatIdRef.current, conversationRef.current, startTimeRef.current);
      }
    };
  }, []); // empty deps = true unmount only

  // Close sidebar + reset fullscreen when leaving the chat tab
  useFocusEffect(
    useCallback(() => {
      return () => {
        sidebarStore.close();
        // Always reset fullscreen when this screen loses focus (tab switch, back button, etc.)
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

  // ─── Load user and most recent chat on mount ────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Get user from Supabase session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('>>> No authenticated user');
          setIsLoadingHistory(false);
          return;
        }

        userIdRef.current = user.id;
        setUserEmail(user.email || '');
        console.log('>>> User loaded:', user.email, '— starting fresh chat');
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

  // ─── Send ─────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading || !userIdRef.current) return;

    const userText = inputText.trim();
    setInputText('');
    setErrorText(null);
    setIsMenuOpen(false);

    if (detectCrisis(userText)) setShowCrisisResources(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      isUser: true,
      timestamp: new Date(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setIsLoading(true);

    try {
      // Create chat if this is the first message
      let currentChatId = chatId;
      let currentConversation = conversation;

      if (!currentChatId && !isIncognito) {
        console.log('>>> Creating new chat for user:', userIdRef.current);
        const newChat = await createChat(userIdRef.current, 'textchat');
        if (newChat) {
          currentChatId = newChat.id;
          setChatId(newChat.id);
          setStartTime(Date.now());
          isFirstExchangeRef.current = true;
        }
      }

      // Build conversation with user message
      if (isIncognito) {
        // In-memory only — never saved to DB
        const userEntry: ChatMessage = { role: 'user', content: userText, timestamp: Date.now() };
        currentConversation = [...currentConversation, userEntry];
        setConversation(currentConversation);
      } else if (currentChatId) {
        currentConversation = await addMessage(currentChatId, 'user', userText, currentConversation);
        setConversation(currentConversation);
      }

      // Send to AI with FULL conversation history for memory
      const bedrockMessages = toBedrockFormat(currentConversation);
      const aiText = normalizeAIText(await sendToBedrock(bedrockMessages));

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        isUser: false,
        timestamp: new Date(),
      };
      const final = [...withUser, aiMsg];
      setMessages(final);

      // Store AI reply in conversation
      if (isIncognito) {
        // In-memory only
        const aiEntry: ChatMessage = { role: 'assistant', content: aiText, timestamp: Date.now() };
        currentConversation = [...currentConversation, aiEntry];
        setConversation(currentConversation);
      } else if (currentChatId) {
        currentConversation = await addMessage(currentChatId, 'assistant', aiText, currentConversation);
        setConversation(currentConversation);

        // Generate title after first exchange
        if (isFirstExchangeRef.current) {
          isFirstExchangeRef.current = false;
          generateAndSetTitle(currentChatId, currentConversation).then((title) => {
            console.log('>>> Title generated:', title);
            setChatTitle(title);
          });
        }
      }
    } catch (err: any) {
      console.error('>>> Send error:', err);
      setErrorText(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, isIncognito, chatId, conversation]);

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
      isFirstExchangeRef.current = (loadedChat.conversation || []).length === 0;

      // Convert to display format
      const restored: Message[] = (loadedChat.conversation || []).map((m, idx) => ({
        id: `restored_${idx}`,
        text: m.content,
        isUser: m.role === 'user',
        timestamp: new Date(m.timestamp),
      }));
      setMessages([WELCOME_MESSAGE, ...restored]);
      setDisplayedMessageIds(new Set(['welcome', ...restored.map((m) => m.id)]));
    }
  }, [finalizeCurrentChat]);

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
  }, [finalizeCurrentChat]);

  const handleExitIncognito = useCallback(() => {
    setIsIncognito(false);
    setChatId(null);
    setConversation([]);
    setMessages([WELCOME_MESSAGE]);
    setDisplayedMessageIds(new Set(['welcome']));
    setChatTitle('New chat');
    isFirstExchangeRef.current = true;
  }, []);

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
    if (chatId) await updateTitle(chatId, newTitle);
  }, [chatId]);

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
    setErrorText(null);
    setStartTime(Date.now());
    isFirstExchangeRef.current = true;
    sidebarStore.close();
  }, [finalizeCurrentChat]);

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
    if (chatId) await deleteChat(chatId);
    setChatId(null);
    setConversation([]);
    setMessages([WELCOME_MESSAGE]);
    setDisplayedMessageIds(new Set(['welcome']));
    setChatTitle('New chat');
    setIsStarred(false);
    setChatFeedback(null);
    setStartTime(Date.now());
    isFirstExchangeRef.current = true;
  }, [chatId]);

  const handleStar = useCallback(() => {
    setIsMenuOpen(false);
    const next = !isStarred;
    setIsStarred(next);
    if (chatId) starChat(chatId, next);
  }, [chatId, isStarred]);

  // ─── Render message ───────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    if (item.id === 'welcome') return null;
    return (
      <ChatMessageItem
        item={item}
        isNew={isNewMessage(item.id)}
        showTypewriter={!item.isUser && !displayedMessageIds.has(item.id)}
        onTypewriterComplete={handleTypewriterComplete}
        onCopy={handleCopy}
        onLike={handleLike}
        onDislike={handleDislike}
      />
    );
  }, [displayedMessageIds, handleTypewriterComplete, handleCopy, handleLike, handleDislike]);

  const renderFooter = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.rowAI}>
          <View style={styles.aiContent}>
            <LoadingDots color="rgba(0,0,0,0.3)" dotSize={7} />
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
    sendScale.value = withTiming(0.88, { duration: 80 }, () => {
      sendScale.value = withTiming(1, { duration: 120 });
    });
    handleSend();
  }, [handleSend]);

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
            onRename={handleRename}
            onStar={handleStar}
            onDelete={handleDelete}
            onNewChat={handleNewChat}
            onClose={() => setIsMenuOpen(false)}
          />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop }]}>
          <Pressable style={styles.headerBtn} hitSlop={8} onPress={sidebarStore.open}>
            <Ionicons name="menu" size={24} color="#1A1A1A" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.logoText}>mello</Text>
            <Animated.View style={subtitleAnimStyle}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {headerSubtitleText}
              </Text>
            </Animated.View>
          </View>

          {isIncognito ? (
            <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => fadeSwitchMode(handleExitIncognito)}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </Pressable>
          ) : chatState === 'active' ? (
            <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => setIsMenuOpen((v) => !v)}>
              <Ionicons name="ellipsis-vertical" size={22} color="#1A1A1A" />
            </Pressable>
          ) : (
            <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => fadeSwitchMode(handleStartIncognito)}>
              <Ionicons name="eye-off-outline" size={22} color="#1A1A1A" />
            </Pressable>
          )}
        </View>

        {/* ── Content ── */}
        <Animated.View style={[styles.flex, contentAnimStyle]}>
          {isIncognito && chatState === 'greeting' ? (
            <View style={styles.greetingContainer}>
              <Ionicons name="eye-off-outline" size={48} color="#1A1A1A" style={styles.incognitoIcon} />
              <Text style={styles.incognitoTitle}>Incognito chat</Text>
              <Text style={styles.incognitoSubtitle}>
                This conversation won't be saved or used to personalise your profile.
              </Text>
            </View>
          ) : chatState === 'greeting' ? (
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingText}>
                {'How can I help you\n' + getTimeGreeting()}
              </Text>
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
                  isLoading ? 'Mello is thinking...'
                  : chatState === 'active' ? 'Reply to Mello'
                  : 'Chat with mello'
                }
                placeholderTextColor="rgba(0,0,0,0.35)"
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
                        <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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

      {/* ── Crisis Modal ── */}
      {showCrisisResources && (
        <View style={styles.crisisOverlay}>
          <View style={styles.crisisCard}>
            <Text style={styles.crisisTitle}>Mello cares about you</Text>
            <Text style={styles.crisisText}>
              It sounds like you might be going through something difficult.
              Would you like to see some resources that can help?
            </Text>
            <Pressable style={styles.crisisBtn}
              onPress={() => { setShowCrisisResources(false); callCrisisLine(); }}>
              <Text style={styles.crisisBtnText}>View Resources</Text>
            </Pressable>
            <Pressable style={styles.crisisDismiss} onPress={() => setShowCrisisResources(false)}>
              <Text style={styles.crisisDismissText}>Continue Chatting</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    fontFamily: 'Playwrite',
    fontSize: 26,
    color: '#1A1A1A',
    lineHeight: 32,
    marginBottom: 10,
  },
  headerSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  contextMenuTitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contextMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 12,
    marginBottom: 4,
  },
  contextMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  contextMenuLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
  },
  contextMenuDanger: { color: '#EF4444' },

  // ── Greeting ──
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  greetingText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 32,
    color: '#1A1A1A',
    lineHeight: 42,
    textAlign: 'center',
  },

  // ── Incognito empty state ──
  incognitoIcon: {
    marginBottom: 20,
    opacity: 0.7,
  },
  incognitoTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 20,
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  incognitoSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: 'rgba(0,0,0,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // ── Messages ──
  messageList: {
    paddingHorizontal: 20,
    paddingTop: 12,       // ↓ was 8
    paddingBottom: 35,    // ↓ was 12
  },
  rowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,     // ↓ was 6
  },
  userBubble: {
    backgroundColor: '#ffffffad',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '78%',
  },
  userText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 23,
  },
  rowAI: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 2,     // ↓ was 6
  },
  // KEY FIX: removed flex:1 which was stretching AI rows to fill remaining space
  aiContent: {
    maxWidth: '85%',     // replaces flex:1 — constrains width without stretching height
    paddingRight: 8,     // ↓ was 40 — that extra right padding was adding dead space
  },
  aiText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 25,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
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
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
    textAlign: 'center',
  },
  errorDismiss: {
    fontFamily: 'Outfit-Medium',
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
  },

  // ── Input ──
  inputWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputPill: {
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 6,
  },
  inputPillFocused: {
    borderColor: 'rgba(0,0,0,0.14)',
  },
  inputPillIncognito: {
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.2)',
  },
  input: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 22,
    minHeight: 22,
    maxHeight: 110,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: 'top',
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
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceModeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#050505',
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
    backgroundColor: '#FFFFFF',
    opacity: 0.92,
  },
  voiceBar: {
    width: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 20,
  },
  crisisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  crisisTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 22,
    color: '#1A1A1A',
    marginBottom: 14,
    textAlign: 'center',
  },
  crisisText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: 'rgba(0,0,0,0.55)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  crisisBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  crisisBtnText: {
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  crisisDismiss: { paddingVertical: 12 },
  crisisDismissText: {
    fontFamily: 'Outfit-Regular',
    color: 'rgba(0,0,0,0.4)',
    fontSize: 14,
  },
});
