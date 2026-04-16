/**
 * ChatsPage
 * Full chats list screen — Claude Android–inspired design for Mello.
 *
 * Features:
 *  - Search bar
 *  - Starred chats section
 *  - Selection mode (tap select icon → select all; back button to exit)
 *  - Multi-delete with trash icon in header
 *  - Long-press context menu: rename / star / delete
 *  - New Chat FAB (#b9a6ff)
 *  - Smooth no-bounce ease transitions
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  getChats,
  deleteChat,
  starChat,
  updateTitle,
  formatRelativeTime,
  type ChatListItem,
} from '@/services/chat/chatService';
import { chatNavStore } from '@/utils/chatNavStore';
import { sidebarStore } from '@/utils/sidebarStore';
import { supabase } from '@/lib/supabase';
import RenameChatSheet from './RenameChatSheet';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const ACCENT = '#b9a6ff';
const BG = '#F5F3EE';
const EASE = Easing.out(Easing.cubic);
const TIMING = (ms = 220) => ({ duration: ms, easing: EASE });

// ═══════════════════════════════════════════════════════════
// CONTEXT MENU SHEET (long press — same pattern as DeleteChatSheet)
// ═══════════════════════════════════════════════════════════

interface ContextMenuProps {
  chat: ChatListItem;
  onRename: () => void;
  onStar: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const ContextMenuPopup = memo(({ chat, onRename, onStar, onDelete, onClose }: ContextMenuProps) => {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = React.useState(true);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  // Open on mount
  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 300 });
    translateY.value = withSpring(0, { damping: 50, stiffness: 150, mass: 0.5 });
  }, []);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  }, [hideModal]);

  const handleAction = useCallback((action: () => void) => {
    handleClose();
    setTimeout(action, 300);
  }, [handleClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={ctxStyles.container}>
        {/* Backdrop */}
        <Animated.View style={[ctxStyles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[ctxStyles.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={ctxStyles.handleBar} />

          <View style={[ctxStyles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {/* Chat title */}
            <Text style={ctxStyles.chatTitle} numberOfLines={2}>{chat.title}</Text>

            <View style={ctxStyles.divider} />

            {/* Rename */}
            <TouchableOpacity
              style={ctxStyles.row}
              onPress={() => handleAction(onRename)}
              activeOpacity={0.7}
            >
              <View style={ctxStyles.iconWrap}>
                <Ionicons name="pencil-outline" size={20} color="#1A1A1A" />
              </View>
              <Text style={ctxStyles.rowLabel}>Rename</Text>
            </TouchableOpacity>

            {/* Star / Unstar */}
            <TouchableOpacity
              style={ctxStyles.row}
              onPress={() => handleAction(onStar)}
              activeOpacity={0.7}
            >
              <View style={ctxStyles.iconWrap}>
                <Ionicons
                  name={chat.is_starred ? 'star' : 'star-outline'}
                  size={20}
                  color={chat.is_starred ? ACCENT : '#1A1A1A'}
                />
              </View>
              <Text style={ctxStyles.rowLabel}>{chat.is_starred ? 'Unstar' : 'Star'}</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={ctxStyles.row}
              onPress={() => handleAction(onDelete)}
              activeOpacity={0.7}
            >
              <View style={[ctxStyles.iconWrap, ctxStyles.iconDestructive]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[ctxStyles.rowLabel, ctxStyles.rowLabelDestructive]}>Delete</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={ctxStyles.cancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={ctxStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const ctxStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  chatTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 14,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDestructive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  rowLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
  },
  rowLabelDestructive: {
    color: '#EF4444',
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    marginTop: 8,
  },
  cancelBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#666',
  },
});

// ═══════════════════════════════════════════════════════════
// CONFIRM DELETE SHEET (same pattern as SignOutBottomSheet)
// ═══════════════════════════════════════════════════════════

interface ConfirmDeleteSheetProps {
  visible: boolean;
  count: number;           // 1 = single chat, N = multi
  chatTitle: string | null; // set for single, null for multi
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmDeleteSheet({ visible, count, chatTitle, onClose, onConfirm }: ConfirmDeleteSheetProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = React.useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 50, stiffness: 150, mass: 0.5 });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
        if (finished) runOnJS(hideModal)();
      });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  }, [hideModal]);

  const handleConfirm = useCallback(() => {
    handleClose();
    setTimeout(onConfirm, 300);
  }, [handleClose, onConfirm]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const title = count === 1
    ? 'Delete this chat?'
    : `Delete ${count} chats?`;

  const subtitle = count === 1 && chatTitle
    ? `"${chatTitle}" will be permanently deleted. This can't be undone.`
    : `${count} chats will be permanently deleted. This can't be undone.`;

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={cdStyles.container}>
        <Animated.View style={[cdStyles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[cdStyles.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={cdStyles.handleBar} />
          <View style={[cdStyles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {/* Icon */}
            <View style={cdStyles.iconWrap}>
              <Ionicons name="trash-outline" size={26} color="#EF4444" />
            </View>
            <Text style={cdStyles.title}>{title}</Text>
            <Text style={cdStyles.subtitle}>{subtitle}</Text>
            <View style={cdStyles.buttons}>
              <TouchableOpacity style={cdStyles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={cdStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cdStyles.deleteBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Text style={cdStyles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const cdStyles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 18,
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  cancelBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#666',
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  deleteBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});

// ═══════════════════════════════════════════════════════════
// CHAT ROW
// ═══════════════════════════════════════════════════════════

interface ChatRowProps {
  chat: ChatListItem;
  isSelecting: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggle: () => void;
}

const ChatRow = memo(({
  chat,
  isSelecting,
  isSelected,
  onPress,
  onLongPress,
  onToggle,
}: ChatRowProps) => {
  const circleAnim = useSharedValue(isSelecting ? 1 : 0);

  useEffect(() => {
    circleAnim.value = withTiming(isSelecting ? 1 : 0, TIMING(200));
  }, [isSelecting]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: circleAnim.value,
    transform: [{ translateX: interpolate(circleAnim.value, [0, 1], [-20, 0]) }],
    width: interpolate(circleAnim.value, [0, 1], [0, 28]),
  }));

  return (
    <Pressable
      style={({ pressed }) => [styles.chatRow, pressed && styles.chatRowPressed]}
      onPress={isSelecting ? onToggle : onPress}
      onLongPress={!isSelecting ? onLongPress : undefined}
      delayLongPress={420}
      android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
    >
      {/* Selection circle */}
      <Animated.View style={[styles.circleWrap, circleStyle]}>
        <Pressable onPress={onToggle} hitSlop={8}>
          <View style={[styles.circle, isSelected && styles.circleSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </Pressable>
      </Animated.View>

      {/* Chat info */}
      <View style={styles.chatInfo}>
        <View style={styles.chatTitleRow}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {chat.title}
          </Text>
          {chat.is_starred && (
            <Ionicons name="star" size={13} color={ACCENT} style={styles.starBadge} />
          )}
        </View>
        <Text style={styles.chatTime}>{formatRelativeTime(chat.updated_at)}</Text>
      </View>
    </Pressable>
  );
});

// ═══════════════════════════════════════════════════════════
// SELECT-ALL ROW (top of list in select mode)
// ═══════════════════════════════════════════════════════════

interface SelectAllRowProps {
  total: number;
  selectedCount: number;
  visible: boolean;
  onToggle: () => void;
}

const SelectAllRow = memo(({ total, selectedCount, visible, onToggle }: SelectAllRowProps) => {
  const anim = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    anim.value = withTiming(visible ? 1 : 0, TIMING(200));
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [-12, 0]) }],
    height: interpolate(anim.value, [0, 1], [0, 52]),
    overflow: 'hidden',
  }));

  const allSelected = selectedCount === total && total > 0;

  return (
    <Animated.View style={style}>
      <Pressable
        style={styles.selectAllRow}
        onPress={onToggle}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
      >
        <View style={[styles.selectAllCircle, allSelected && styles.circleSelected]}>
          {allSelected && <Ionicons name="checkmark" size={15} color="#fff" />}
        </View>
        <Text style={styles.selectAllLabel}>
          {allSelected ? `All selected (${total})` : `Select all (${total})`}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════

const SectionHeader = memo(({ title }: { title: string }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
));

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ChatsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Data
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Selection
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Context menu
  const [contextChat, setContextChat] = useState<ChatListItem | null>(null);

  // Sheets
  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  // sheetTarget = single chat to delete (null = multi-delete selected set)
  const [sheetTarget, setSheetTarget] = useState<ChatListItem | null>(null);

  // Animation
  const headerSelectAnim = useSharedValue(0); // 0 = normal, 1 = selecting

  // ── Load chats ──────────────────────────────────────────
  const loadChats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }
    const loaded = await getChats(user.id, 100);
    setChats(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  // ── Derived lists ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, searchText]);

  const starredChats = useMemo(() => filtered.filter((c) => c.is_starred), [filtered]);
  const regularChats = useMemo(() => filtered.filter((c) => !c.is_starred), [filtered]);

  // ── Header animation ─────────────────────────────────────
  useEffect(() => {
    headerSelectAnim.value = withTiming(isSelecting ? 1 : 0, TIMING(220));
  }, [isSelecting]);

  const leftBtnNormal = useAnimatedStyle(() => ({
    opacity: 1 - headerSelectAnim.value,
    transform: [{ translateX: interpolate(headerSelectAnim.value, [0, 1], [0, -12]) }],
  }));
  const leftBtnSelect = useAnimatedStyle(() => ({
    opacity: headerSelectAnim.value,
    transform: [{ translateX: interpolate(headerSelectAnim.value, [0, 1], [12, 0]) }],
  }));
  const rightBtnNormal = useAnimatedStyle(() => ({
    opacity: 1 - headerSelectAnim.value,
    transform: [{ scale: interpolate(headerSelectAnim.value, [0, 1], [1, 0.7]) }],
  }));
  const rightBtnDelete = useAnimatedStyle(() => ({
    opacity: selectedIds.size > 0 ? headerSelectAnim.value : 0,
    transform: [{ scale: interpolate(headerSelectAnim.value, [0, 1], [0.7, 1]) }],
  }));

  // ── Selection handlers ───────────────────────────────────
  const enterSelectAll = useCallback(() => {
    setIsSelecting(true);
    setSelectedIds(new Set(chats.map((c) => c.id)));
  }, [chats]);

  const exitSelecting = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === chats.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(chats.map((c) => c.id)));
    }
  }, [chats, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Navigation ───────────────────────────────────────────
  const openChat = useCallback((session: ChatListItem) => {
    chatNavStore.push({ type: 'select-session', session });
    router.navigate('/(main)/chat' as any);
  }, [router]);

  const openNewChat = useCallback(() => {
    chatNavStore.push({ type: 'new-chat' });
    router.navigate('/(main)/chat' as any);
  }, [router]);

  // ── Long press context menu ──────────────────────────────
  const handleLongPress = useCallback((chat: ChatListItem) => {
    setContextChat(chat);
  }, []);

  const closeContext = useCallback(() => setContextChat(null), []);

  // ── Context menu actions ─────────────────────────────────
  const handleContextRename = useCallback(() => {
    setSheetTarget(contextChat);
    setShowRenameSheet(true);
    closeContext();
  }, [contextChat, closeContext]);

  const handleContextStar = useCallback(async () => {
    if (!contextChat) return;
    const next = !contextChat.is_starred;
    await starChat(contextChat.id, next);
    setChats((prev) =>
      prev.map((c) => c.id === contextChat.id ? { ...c, is_starred: next } : c),
    );
    closeContext();
  }, [contextChat, closeContext]);

  const handleContextDelete = useCallback(() => {
    setSheetTarget(contextChat);   // single target
    setShowConfirmDelete(true);
    closeContext();
  }, [contextChat, closeContext]);

  // ── Rename save ──────────────────────────────────────────
  const handleRenameSave = useCallback(async (newTitle: string) => {
    if (!sheetTarget) return;
    await updateTitle(sheetTarget.id, newTitle);
    setChats((prev) =>
      prev.map((c) => c.id === sheetTarget.id ? { ...c, title: newTitle } : c),
    );
    setSheetTarget(null);
  }, [sheetTarget]);

  // ── Confirm delete (single OR multi) ─────────────────────
  const handleConfirmDeletePress = useCallback(() => {
    setSheetTarget(null);      // multi: no single target
    setShowConfirmDelete(true);
  }, []);

  const handleConfirmDeleteExecute = useCallback(async () => {
    setShowConfirmDelete(false);
    if (sheetTarget) {
      // Single chat
      await deleteChat(sheetTarget.id);
      setChats((prev) => prev.filter((c) => c.id !== sheetTarget.id));
      setSheetTarget(null);
    } else {
      // Multi-delete selected set
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => deleteChat(id)));
      setChats((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setIsSelecting(false);
    }
  }, [sheetTarget, selectedIds]);

  // ── Render helpers ───────────────────────────────────────
  const paddingTop = insets.top + 12;

  const renderChatRow = useCallback((chat: ChatListItem) => (
    <ChatRow
      key={chat.id}
      chat={chat}
      isSelecting={isSelecting}
      isSelected={selectedIds.has(chat.id)}
      onPress={() => openChat(chat)}
      onLongPress={() => handleLongPress(chat)}
      onToggle={() => toggleSelect(chat.id)}
    />
  ), [isSelecting, selectedIds, openChat, handleLongPress, toggleSelect]);

  // Build flat data for FlatList with section markers
  type ListItem =
    | { kind: 'selectAll' }
    | { kind: 'section'; title: string }
    | { kind: 'chat'; chat: ChatListItem }
    | { kind: 'empty' };

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    if (isSelecting) {
      items.push({ kind: 'selectAll' });
    }

    if (starredChats.length > 0) {
      items.push({ kind: 'section', title: 'Starred' });
      starredChats.forEach((c) => items.push({ kind: 'chat', chat: c }));
    }

    if (regularChats.length > 0) {
      if (starredChats.length > 0) {
        items.push({ kind: 'section', title: 'Recent' });
      }
      regularChats.forEach((c) => items.push({ kind: 'chat', chat: c }));
    }

    if (!isLoading && filtered.length === 0) {
      items.push({ kind: 'empty' });
    }

    return items;
  }, [isSelecting, starredChats, regularChats, isLoading, filtered.length]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'selectAll') {
      return (
        <SelectAllRow
          total={chats.length}
          selectedCount={selectedIds.size}
          visible
          onToggle={toggleSelectAll}
        />
      );
    }
    if (item.kind === 'section') {
      return <SectionHeader title={item.title} />;
    }
    if (item.kind === 'chat') {
      return (
        <ChatRow
          chat={item.chat}
          isSelecting={isSelecting}
          isSelected={selectedIds.has(item.chat.id)}
          onPress={() => openChat(item.chat)}
          onLongPress={() => handleLongPress(item.chat)}
          onToggle={() => toggleSelect(item.chat.id)}
        />
      );
    }
    if (item.kind === 'empty') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={44} color="rgba(0,0,0,0.15)" />
          <Text style={styles.emptyText}>
            {searchText ? 'No chats match your search' : 'No chats yet'}
          </Text>
        </View>
      );
    }
    return null;
  }, [chats.length, selectedIds, isSelecting, toggleSelectAll, openChat, handleLongPress, toggleSelect, searchText]);

  const keyExtractor = useCallback((item: ListItem, index: number): string => {
    if (item.kind === 'chat') return item.chat.id;
    if (item.kind === 'section') return `section-${item.title}`;
    return `${item.kind}-${index}`;
  }, []);

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Left — hamburger OR back (animated swap) */}
        <View style={styles.headerSide}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.headerBtn, leftBtnNormal]}
            pointerEvents={isSelecting ? 'none' : 'auto'}
          >
            <Pressable onPress={sidebarStore.open} hitSlop={10}>
              <Ionicons name="menu" size={24} color="#1A1A1A" />
            </Pressable>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.headerBtn, leftBtnSelect]}
            pointerEvents={isSelecting ? 'auto' : 'none'}
          >
            <Pressable onPress={exitSelecting} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </Pressable>
          </Animated.View>
        </View>

        {/* Center — mello logo */}
        <View style={styles.headerCenter}>
          <Text style={styles.logoText}>mello</Text>
        </View>

        {/* Right — select-all icon OR delete icon */}
        <View style={styles.headerSide}>
          {/* Normal: select-all checklist icon */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.headerBtn, rightBtnNormal]}
            pointerEvents={isSelecting ? 'none' : 'auto'}
          >
            <Pressable onPress={enterSelectAll} hitSlop={10}>
              <Ionicons name="checkbox-outline" size={22} color="#1A1A1A" />
            </Pressable>
          </Animated.View>
          {/* Select mode: delete icon (only when items selected) */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.headerBtn, rightBtnDelete]}
            pointerEvents={isSelecting && selectedIds.size > 0 ? 'auto' : 'none'}
          >
            <Pressable onPress={handleConfirmDeletePress} hitSlop={10}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* ── "Chats" title ── */}
      <Text style={styles.pageTitle}>Chats</Text>

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="rgba(0,0,0,0.35)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search Chats"
          placeholderTextColor="rgba(0,0,0,0.35)"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Chat list ── */}
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* ── FAB: New chat ── */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={openNewChat}
        android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
      >
        <Ionicons name="chatbubble-outline" size={20} color="#fff" />
        <Text style={styles.fabLabel}>New chat</Text>
      </Pressable>

      {/* ── Context menu ── */}
      {contextChat && (
        <ContextMenuPopup
          chat={contextChat}
          onRename={handleContextRename}
          onStar={handleContextStar}
          onDelete={handleContextDelete}
          onClose={closeContext}
        />
      )}

      {/* ── Rename sheet ── */}
      <RenameChatSheet
        visible={showRenameSheet}
        currentTitle={sheetTarget?.title || ''}
        onClose={() => setShowRenameSheet(false)}
        onSave={handleRenameSave}
      />

      {/* ── Confirm delete sheet (single + multi) ── */}
      <ConfirmDeleteSheet
        visible={showConfirmDelete}
        count={sheetTarget ? 1 : selectedIds.size}
        chatTitle={sheetTarget?.title || null}
        onClose={() => { setShowConfirmDelete(false); setSheetTarget(null); }}
        onConfirm={handleConfirmDeleteExecute}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header — exact match to ChatScreen
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
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

  // Page title
  pageTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 34,
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
  },

  // List
  listContent: {
    paddingHorizontal: 0,
  },

  // Select-all row
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginBottom: 4,
  },
  selectAllCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  selectAllLabel: {
    fontFamily: 'Outfit-Medium',
    fontSize: 15,
    color: '#1A1A1A',
  },

  // Section header
  sectionHeader: {
    fontFamily: 'Outfit-Medium',
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },

  // Chat row
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  chatRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    overflow: 'hidden',
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chatInfo: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 22,
  },
  starBadge: {
    marginBottom: 1,
  },
  chatTime: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: 'rgba(0,0,0,0.35)',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 50,
    gap: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabLabel: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#fff',
  },

});
