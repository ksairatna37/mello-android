/**
 * CheckInTimesSheet — bottom-sheet modal for picking 0–2 check-in
 * time slots. Same chrome/animation as `RadioSheet` and
 * `EditNameSheet` but renders multi-select pill chips: tap to add /
 * remove a slot, with a soft cap at 2 (extra taps no-op rather than
 * silently dropping the oldest pick).
 *
 * Why a 0–2 cap: more than two daily check-ins drifts toward
 * "tracking" UX which the broader product voice avoids. A morning
 * anchor + evening review is the upper bound.
 *
 * The sheet owns a draft state initialized from `initialValue`. The
 * user only commits via "Save" — backdrop / Cancel discard the draft.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

interface Option {
  key: string;
  label: string;
}

interface Props {
  visible: boolean;
  options: ReadonlyArray<Option>;
  initialValue?: ReadonlyArray<string>;
  onSave: (next: ReadonlyArray<string>) => void;
  onClose: () => void;
}

const ANIM_MS = 220;
const MAX_PICKS = 2;

export default function CheckInTimesSheet({
  visible,
  options,
  initialValue,
  onSave,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ReadonlyArray<string>>(initialValue ?? []);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (visible) setDraft(initialValue ?? []);
  }, [visible, initialValue, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 60 }],
    opacity: progress.value,
  }));

  const toggle = (key: string) => {
    setDraft((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      // Soft cap: ignore the tap rather than silently bumping the oldest.
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, key];
    });
  };

  const handleSave = () => onSave(draft);

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
            { bottom: Math.max(insets.bottom, 16) },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.kicker}>— pick up to two</Text>
          <Text style={styles.title}>When should I tap on the door?</Text>
          <Text style={styles.lede}>
            We{"’"}ll send a soft nudge at these times. Tap a chip to remove it. Leave them all off for no scheduled check-ins.
          </Text>

          <View style={styles.chips}>
            {options.map((opt) => {
              const on = draft.includes(opt.key);
              const disabled = !on && draft.length >= MAX_PICKS;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => toggle(opt.key)}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.chip,
                    on ? styles.chipOn : styles.chipOff,
                    disabled && styles.chipDisabled,
                    pressed && !disabled && styles.chipPressed,
                  ]}
                >
                  {on && <Glyphs.Check size={12} color={C.ink} />}
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
            >
              <Text style={styles.btnGhostLabel}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            >
              <Text style={styles.btnPrimaryLabel}>Save</Text>
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
   * inset from screen edges, fully rounded, shadow-lifted. */
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

  chips: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  chipOff: {
    backgroundColor: C.paper,
    borderColor: C.line2,
  },
  chipOn: {
    backgroundColor: C.peach,
    borderColor: 'transparent',
  },
  chipDisabled: { opacity: 0.45 },
  chipPressed: { opacity: 0.85 },
  chipLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: C.ink2,
  },
  chipLabelOn: { color: C.ink },

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
  btnPressed: { opacity: 0.85 },
  btnPrimaryLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
});
