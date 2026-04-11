/**
 * ChatSidebar — Left drawer (Claude-style)
 *
 * Rendered as an absolute overlay inside ChatScreen (inside the content card).
 * The tab bar is a sibling rendered AFTER the content card in the root layout,
 * so it naturally sits on top — the sidebar never covers it.
 *
 * Sections:
 *   mello logo
 *   + New chat  (accent color)
 *   Chats
 *   ─────────
 *   Recents (scrollable, fills middle space)
 *   ─────────────────── (bottom, always pinned)
 *   User avatar + name + settings
 */

import React, { useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getSessions, formatSessionTime, type ChatSession } from '@/services/chat/sessionHistory';

interface ChatSidebarProps {
  visible: boolean;
  currentSessionId: string;
  currentTitle: string;
  userEmail: string;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (session: ChatSession) => void;
}

const DRAWER_WIDTH_RATIO = 0.82;
const ANIM_MS = 220;
const SWIPE_CLOSE_THRESHOLD = 60;

export default memo(function ChatSidebar({
  visible,
  currentSessionId,
  currentTitle,
  userEmail,
  onClose,
  onNewChat,
  onSelectSession,
}: ChatSidebarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = width * DRAWER_WIDTH_RATIO;

  const translateX = useSharedValue(-drawerWidth);
  const backdropOpacity = useSharedValue(0);

  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const hasOpenedRef = useRef(false);

  // Load sessions each time sidebar opens
  useEffect(() => {
    if (visible) {
      getSessions().then(setSessions);
    }
  }, [visible]);

  // Hardware back button closes the sidebar
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true; // consume the event
    });
    return () => sub.remove();
  }, [visible, onClose]);

  // Drive open/close animation
  useEffect(() => {
    if (visible) {
      hasOpenedRef.current = true;
      translateX.value = withTiming(0, { duration: ANIM_MS, easing: Easing.out(Easing.quad) });
      backdropOpacity.value = withTiming(0.45, { duration: ANIM_MS });
    } else if (hasOpenedRef.current) {
      translateX.value = withTiming(-drawerWidth, { duration: ANIM_MS, easing: Easing.in(Easing.quad) });
      backdropOpacity.value = withTiming(0, { duration: ANIM_MS });
    }
  }, [visible, drawerWidth]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Swipe left to close
  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 100])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -drawerWidth);
        backdropOpacity.value = Math.max(0, 0.45 * (1 + e.translationX / drawerWidth));
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_CLOSE_THRESHOLD || e.velocityX < -600) {
        runOnJS(onClose)();
      } else {
        translateX.value = withTiming(0, { duration: ANIM_MS });
        backdropOpacity.value = withTiming(0.45, { duration: ANIM_MS });
      }
    });

  const displayName = userEmail.split('@')[0] || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  if (!hasOpenedRef.current && !visible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Backdrop — dark tint, tap to close */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents="none"
      />
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.drawer,
            { width: drawerWidth, paddingTop: insets.top + 16 },
            drawerStyle,
          ]}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>mello</Text>
          </View>

          {/* New chat */}
          <Pressable
            style={styles.newChatRow}
            onPress={() => { onClose(); onNewChat(); }}
          >
            <View style={styles.newChatIcon}>
              <Ionicons name="add-circle-outline" size={22} color="#b9a6ff" />
            </View>
            <Text style={styles.newChatLabel}>New chat</Text>
          </Pressable>

          {/* Chats nav */}
          <Pressable style={styles.navRow} onPress={onClose}>
            <Ionicons name="chatbubbles-outline" size={20} color="rgba(0,0,0,0.6)" style={styles.navIcon} />
            <Text style={styles.navLabel}>Chats</Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Recents — expands to fill remaining space */}
          {sessions.length > 0 ? (
            <View style={styles.recentsSection}>
              <Text style={styles.sectionHeader}>Recents</Text>
              <ScrollView
                style={styles.sessionList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sessionListContent}
              >
                {sessions.map((s) => (
                  <Pressable
                    key={s.id}
                    style={[
                      styles.sessionRow,
                      s.id === currentSessionId && styles.sessionRowActive,
                    ]}
                    onPress={() => { onClose(); onSelectSession(s); }}
                  >
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {s.id === currentSessionId ? currentTitle : s.title}
                    </Text>
                    <Text style={styles.sessionTime}>{formatSessionTime(s.updatedAt)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.recentsSection} />
          )}

          {/* Bottom user row — always pinned to bottom */}
          <View style={[styles.bottomRow, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{userInitial}</Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="settings-outline" size={20} color="rgba(0,0,0,0.5)" />
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    zIndex: 200,
    elevation: 10,
  },
  backdrop: {
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#F5F3EE',
    paddingHorizontal: 20,
    // Right-side soft rounded corners only
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    // Flex column so recentsSection grows and bottom row pins to bottom
    flexDirection: 'column',
  },

  // Logo
  logoRow: {
    marginBottom: 28,
  },
  logoText: {
    fontFamily: 'Playwrite',
    fontSize: 30,
    color: '#1A1A1A',
  },

  // New chat
  newChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  newChatIcon: {
    marginRight: 12,
  },
  newChatLabel: {
    fontFamily: 'Outfit-Medium',
    fontSize: 17,
    color: '#b9a6ff',
  },

  // Nav rows
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  navIcon: {
    marginRight: 12,
  },
  navLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 17,
    color: '#1A1A1A',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 16,
  },

  // Recents section — flex:1 fills middle space
  recentsSection: {
    flex: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    fontFamily: 'Outfit-Medium',
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  sessionList: {
    flex: 1,
  },
  sessionListContent: {
    gap: 0,
  },
  sessionRow: {
    paddingVertical: 10,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  sessionRowActive: {
    backgroundColor: 'rgba(185,166,255,0.15)',
    paddingHorizontal: 8,
  },
  sessionTitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  sessionTime: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.4)',
    marginTop: 2,
  },

  // Bottom user row — always at the very bottom
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  userName: {
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: '#1A1A1A',
    flex: 1,
  },
});
