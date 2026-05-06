/**
 * DeleteAccountSheet — destructive confirmation for permanent account
 * deletion.
 *
 * Same SelfMind floating-sheet chrome as the other profile sheets
 * (RadioSheet / EditNameSheet / CheckInTimesSheet / SignOutBottomSheet)
 * but with a stricter type-to-confirm gate: the destructive action is
 * disabled until the user types `delete` (lowercase, exact match).
 *
 * UX rationale:
 *   - A double-tap or muscle-memory tap on a list row should NOT cost
 *     a user their account. The type-gate forces a deliberate moment.
 *   - The lede explicitly enumerates what will be lost (chats, profile,
 *     settings) so the user can't claim they didn't know.
 *   - "Permanent" stated twice — the row label and the lede — because
 *     mental-health-app users sometimes act in distress; we want them
 *     to read at least one warning even if they skim.
 *
 * Backend: calls `deleteAccountRemote` (DELETE /rest/v1/auth/user via
 * service-role on the ECS backend). On success the parent fires
 * AuthContext.signOut which clears all local caches and RouterGate
 * routes to /welcome.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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

interface Props {
  visible: boolean;
  loading?: boolean;
  /** Optional error message to surface below the input (e.g. server
   *  rejection). Caller controls; sheet stays open until user
   *  dismisses or retries. */
  errorMessage?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const ANIM_MS = 220;
const CONFIRM_TOKEN = 'delete';

export default function DeleteAccountSheet({
  visible,
  loading = false,
  errorMessage,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  /* In-flight guard — parent's `loading` flag also gates the button,
   * but a state-propagation lag opens a one-render double-tap window. */
  const submittingRef = useRef(false);

  const progress = useSharedValue(0);
  const [isMounted, setIsMounted] = useState(false);

  const finalizeUnmount = () => {
    setIsMounted(false);
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setValue('');
      submittingRef.current = false;
      progress.value = withTiming(1, {
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic),
      });
      // Match EditNameSheet — focus after the mount animation lands
      // so the keyboard doesn't tear into the slide-up.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    } else if (isMounted) {
      progress.value = withTiming(
        0,
        { duration: ANIM_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finalizeUnmount)();
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isMounted]);

  /* Release the in-flight guard on EVERY `loading: true → false`
   * transition, not only on `visible` flips. Without this, a server
   * error keeps the sheet open with `submittingRef.current === true`,
   * silently blocking every subsequent retry tap. */
  useEffect(() => {
    if (!loading) submittingRef.current = false;
  }, [loading]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 60 }],
    opacity: progress.value,
  }));

  const armed = value.trim().toLowerCase() === CONFIRM_TOKEN;

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

  const handleConfirm = () => {
    if (!armed || loading || submittingRef.current) return;
    submittingRef.current = true;
    onConfirm();
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
            { bottom: keyboardHeight > 0 ? keyboardHeight + 12 : Math.max(insets.bottom, 16) },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.kicker}>— delete account</Text>
          <Text style={styles.title}>Delete your account?</Text>
          <Text style={styles.lede}>
            This is permanent. Your chats, mood log, journal, saved spaces, and
            settings are erased and can{"’"}t be recovered. There{"’"}s no undo
            button on the other side.
          </Text>

          <Text style={styles.inputCaption}>
            Type <Text style={styles.inputCaptionToken}>{CONFIRM_TOKEN}</Text> to confirm
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              placeholder={CONFIRM_TOKEN}
              placeholderTextColor={C.ink3}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              editable={!loading}
              selectionColor={C.coral}
            />
          </View>

          {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

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
              onPress={handleConfirm}
              disabled={!armed || loading}
              style={({ pressed }) => [
                styles.btnDestructive,
                (!armed || loading) && styles.btnDestructiveDisabled,
                pressed && armed && !loading && styles.btnPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.cream} />
              ) : (
                <Text
                  style={[
                    styles.btnDestructiveLabel,
                    !armed && styles.btnDestructiveLabelDisabled,
                  ]}
                >
                  Delete forever
                </Text>
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
    color: C.coral,
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

  inputCaption: {
    marginTop: 18,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
  },
  inputCaptionToken: {
    fontFamily: 'JetBrainsMono-Medium',
    color: C.ink,
  },
  inputWrap: {
    marginTop: 8,
    backgroundColor: C.cream2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: C.ink,
    paddingVertical: 12,
    letterSpacing: 0.4,
  },
  errorMessage: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    lineHeight: 18,
    color: C.coral,
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
  btnDestructiveDisabled: { backgroundColor: C.line2 },
  btnDestructiveLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
  btnDestructiveLabelDisabled: { color: C.ink3 },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
});
