/**
 * SignOutBottomSheet — sign-out confirmation in the SelfMind bottom-
 * sheet pattern.
 *
 * Visual chrome matches the rest of the app's profile sheets
 * (RadioSheet / EditNameSheet / CheckInTimesSheet): floating, inset
 * 12 px from screen edges, fully-rounded 28 px corners, drop-shadow,
 * paper canvas, ink/JetBrainsMono kicker + Fraunces title + lede +
 * paired action buttons.
 *
 * Animation uses `withTiming` + `Easing.out(Easing.cubic)` only —
 * spring/bounce physics are explicitly forbidden by `CLAUDE.md` for
 * this codebase.
 *
 * Buttons:
 *   • Cancel — ghost (paper, ink2 label, line2 border).
 *   • Sign out — coral surface, ink label. Coral chosen as the
 *     destructive accent since the broader app already uses coral for
 *     "danger" (see `SelfMindProfile.styles.rowLabelDanger`); ink
 *     reads warmly on coral and avoids stark white-on-red harshness.
 *   • Loading state collapses the button label into an ActivityIndicator
 *     to match the in-screen "Signing out…" affordance the screen had
 *     before the sheet was wired up.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

interface SignOutBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
  loading?: boolean;
}

const ANIM_MS = 220;

export default function SignOutBottomSheet({
  visible,
  onClose,
  onSignOut,
  loading = false,
}: SignOutBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [isMounted, setIsMounted] = React.useState(false);

  const progress = useSharedValue(0);

  /* In-flight guard. The parent's `signingOut` flag also guards via
   * the `loading` prop, but a state propagation lag opens a one-render
   * window where rapid double-tap of "Sign out" can fire `onSignOut`
   * twice before the parent re-renders with `loading=true`. */
  const submittingRef = useRef(false);
  useEffect(() => {
    if (visible) submittingRef.current = false;
  }, [visible]);

  const handleSignOut = useCallback(() => {
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    onSignOut();
  }, [loading, onSignOut]);

  const finalizeUnmount = useCallback(() => {
    setIsMounted(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      progress.value = withTiming(1, {
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic),
      });
    } else if (isMounted) {
      progress.value = withTiming(
        0,
        { duration: ANIM_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finalizeUnmount)();
        },
      );
    }
  }, [visible, isMounted, progress, finalizeUnmount]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 60 }],
    opacity: progress.value,
  }));

  const handleClose = () => {
    if (loading) return;
    progress.value = withTiming(
      0,
      { duration: ANIM_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finalizeUnmount)();
      },
    );
  };

  if (!isMounted) return null;

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { bottom: Math.max(insets.bottom, 16) },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.kicker}>— sign out</Text>
          <Text style={styles.title}>Step away for now?</Text>
          <Text style={styles.lede}>
            You can come back any time — your account is waiting.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              disabled={loading}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && !loading && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
            >
              <Text style={styles.btnGhostLabel}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSignOut}
              disabled={loading}
              style={({ pressed }) => [
                styles.btnDestructive,
                pressed && !loading && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.ink} />
              ) : (
                <Text style={styles.btnDestructiveLabel}>Sign out</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: C.ink },

  /* Floating sheet — matches the chrome of every other profile sheet
   * (inset 12 from edges, full rounded corners, shadow-lifted). */
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: C.paper,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line2,
    marginBottom: 14,
  },
  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: C.ink,
  },
  lede: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 20,
    color: C.ink2,
    maxWidth: 320,
  },

  actions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.paper,
  },
  btnGhostLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink2,
    letterSpacing: 0.1,
  },
  btnDestructive: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coral,
  },
  btnDestructiveLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.1,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
});
