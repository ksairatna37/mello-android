/**
 * EditNameSheet — bottom-sheet modal with a single TextInput for the
 * user's display name (`profiles.username`).
 *
 * Same chrome / animation / token surface as `RadioSheet`. Auto-focus
 * the input on open so the cursor is already blinking when the sheet
 * settles. KeyboardAvoidingView pushes the sheet above the on-screen
 * keyboard. Save button is disabled while empty/whitespace; tapping
 * "Save" fires `onSave(trimmed)` and closes; tapping the backdrop or
 * "Cancel" closes without persisting.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

interface Props {
  visible: boolean;
  initialValue?: string;
  /** Title shown above the input. */
  title?: string;
  /** Tiny caption under the input — short hint or character cap. */
  caption?: string;
  maxLength?: number;
  onSave: (next: string) => void;
  onClose: () => void;
}

const ANIM_MS = 220;

export default function EditNameSheet({
  visible,
  initialValue,
  title = 'Your name',
  caption,
  maxLength = 40,
  onSave,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState(initialValue ?? '');

  /* Manual keyboard tracking — `KeyboardAvoidingView` doesn't reliably
   * work inside a Modal on iOS (the modal renders in its own window
   * tree, and the avoidance math runs against the parent screen, not
   * the modal). We listen to keyboard events directly and lift the
   * sheet's bottom by the keyboard height + a small gap. */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (visible) {
      // Reset to fresh initial value every time we open (so a cancel
      // doesn't bleed an unsaved draft into the next open). Same for
      // the in-flight guard — a fresh open is a fresh submission.
      setValue(initialValue ?? '');
      submittingRef.current = false;
      // Slight delay so the animated mount finishes before iOS
      // raises the keyboard — otherwise the layout flicks.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible, initialValue, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 60 }],
    opacity: progress.value,
  }));

  const trimmed = value.trim();
  const dirty = trimmed.length > 0 && trimmed !== (initialValue ?? '').trim();

  /* In-flight guard — a double-tap of Save (or a keyboard "done"
   * during the close animation) would otherwise fire `onSave` twice,
   * triggering two PATCHes and two onboarding-storage writes. */
  const submittingRef = useRef(false);

  const handleSave = () => {
    // Empty input → no-op (don't close, don't save). Save button is
    // disabled when empty, but `onSubmitEditing` (keyboard "done")
    // can still trigger this path. Silently closing the sheet on
    // empty was a UX surprise — leave it open so the user can re-type.
    if (trimmed.length === 0) return;
    if (!dirty) {
      onClose();
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    onSave(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            // Lift above the keyboard when it's open. Below 0, fall
            // back to the safe-area-aware bottom (matches the other
            // sheets' floating position).
            { bottom: keyboardHeight > 0
                ? keyboardHeight + 12
                : Math.max(insets.bottom, 16) },
            sheetStyle,
          ]}
        >
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>

            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={setValue}
                placeholder="Add your name"
                placeholderTextColor={C.ink3}
                style={styles.input}
                maxLength={maxLength}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                selectionColor={C.coral}
              />
            </View>
            {caption && <Text style={styles.caption}>{caption}</Text>}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
              >
                <Text style={styles.btnGhostLabel}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={!dirty}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  !dirty && styles.btnPrimaryDisabled,
                  pressed && dirty && styles.btnPressed,
                ]}
              >
                <Text style={[styles.btnPrimaryLabel, !dirty && styles.btnPrimaryLabelDisabled]}>
                  Save
                </Text>
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

  /* Floating sheet matching the app's existing bottom-sheet pattern —
   * inset from screen edges, fully rounded, shadow-lifted. Uses
   * `position: 'absolute'` + `left/right: 12` like the other sheets;
   * `bottom` is set inline by the consumer to incorporate keyboard
   * height + safe-area inset. */
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
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: C.ink,
    paddingBottom: 12,
  },

  inputWrap: {
    backgroundColor: C.cream2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    lineHeight: 26,
    color: C.ink,
    paddingVertical: 12,
  },
  caption: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text',
    fontSize: 12,
    lineHeight: 18,
    color: C.ink3,
  },

  actions: {
    marginTop: 18,
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
    backgroundColor: C.paper,
  },
  btnGhostLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink2,
    letterSpacing: 0.1,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    backgroundColor: C.ink,
  },
  btnPrimaryDisabled: { backgroundColor: C.line2 },
  btnPressed: { opacity: 0.8 },
  btnPrimaryLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
  btnPrimaryLabelDisabled: { color: C.ink3 },
});
