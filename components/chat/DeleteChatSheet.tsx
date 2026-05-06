/**
 * DeleteChatSheet — confirm bottom sheet, Claude-design redesign.
 *
 * Visual treatment matches the redesigned RenameChatSheet (paper card,
 * Fraunces headline, JetBrainsMono kicker, Inter pill buttons). The
 * destructive action gets coral; cancel is the soft cream2 secondary.
 *
 * Animation/contract preserved 1:1 — `visible`, `onClose`, `onConfirm`,
 * and the small "close-then-fire" delay so the sheet animates out
 * before the actual delete fires.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DeleteChatSheetProps {
  visible: boolean;
  chatTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteChatSheet({
  visible,
  chatTitle,
  onClose,
  onConfirm,
}: DeleteChatSheetProps) {
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
      backdropOpacity.value = withTiming(1, { duration: 280 });
      translateY.value = withSpring(0, { damping: 50, stiffness: 180, mass: 0.5 });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 280 }, (finished) => {
        if (finished) runOnJS(hideModal)();
      });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 280 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  }, []);

  const handleConfirm = useCallback(() => {
    handleClose();
    // Small delay so sheet animates out before the actual delete fires.
    setTimeout(onConfirm, 280);
  }, [handleClose, onConfirm]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={styles.handleBar} />

          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {/* Trash glyph in a soft coral wash circle. */}
            <View style={styles.iconWrap}>
              <Glyphs.Trash size={22} color={C.coral} />
            </View>

            <Text style={styles.kicker}>— a thread, removed</Text>
            <Text style={styles.title}>
              Delete this <Text style={styles.titleItalic}>thread</Text>?
            </Text>
            <Text style={styles.subtitle} numberOfLines={3}>
              <Text style={styles.subtitleItalic}>{chatTitle || 'this thread'}</Text>{' '}
              will be removed for good. This can{'’'}t be undone.
            </Text>

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Keep it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirm} activeOpacity={0.9}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,31,54,0.42)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 32,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 38,
    height: 4,
    backgroundColor: C.line2,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 14,
    alignItems: 'center',
  },

  /* Coral-wash circle holding the trash glyph — same vibe as the
   * "saved heart" coral pill on practice screens. */
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(244,169,136,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: C.ink,
    textAlign: 'center',
  },
  titleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  subtitle: {
    marginTop: 12,
    marginBottom: 22,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 20,
    color: C.ink2,
    textAlign: 'center',
    letterSpacing: 0.15,
    paddingHorizontal: 6,
  },
  subtitleItalic: { fontFamily: 'Fraunces-Text-Italic' },

  buttons: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    backgroundColor: C.cream2,
    borderWidth: 1,
    borderColor: C.line,
  },
  cancelBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink2,
    letterSpacing: 0.2,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    backgroundColor: C.coral,
  },
  deleteBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.2,
  },
});
