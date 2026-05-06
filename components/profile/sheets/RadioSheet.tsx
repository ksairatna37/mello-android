/**
 * RadioSheet — bottom-sheet modal with a single-select radio list.
 *
 * Used by every profile row that resolves to "pick one of N":
 *   pronouns, age, voice, memory (on/off), therapist style.
 *
 * Visual:
 *   • Backdrop fades 0 → 0.5 (ink @ alpha) over 200 ms.
 *   • Sheet slides up from below safe-area, settles at 24 px above it.
 *   • Cream paper card with rounded top, 1px line border.
 *   • Header: kicker + Fraunces title.
 *   • Rows: Pressable, label left + ink dot right when selected.
 *
 * No spring physics (per CLAUDE.md "Animation easing"). All easing is
 * `Easing.out(Easing.cubic)`.
 *
 * Behavior:
 *   • Tapping an option fires `onSelect(key)` and closes the sheet.
 *   • Tapping the backdrop or hardware back closes without selecting.
 *   • The selected key is highlighted on open so the user sees their
 *     current value before changing it.
 */

import React, { useEffect } from 'react';
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
import Svg, { Circle } from 'react-native-svg';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

export interface RadioSheetOption<T extends string> {
  key: T;
  label: string;
  /** Optional one-line caption shown under the label in muted ink. */
  hint?: string;
}

interface Props<T extends string> {
  visible: boolean;
  title: string;
  kicker?: string;
  options: ReadonlyArray<RadioSheetOption<T>>;
  selected?: T;
  onSelect: (key: T) => void;
  onClose: () => void;
}

const ANIM_MS = 220;

export default function RadioSheet<T extends string>({
  visible,
  title,
  kicker,
  options,
  selected,
  onSelect,
  onClose,
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 60 }],
    opacity: progress.value,
  }));

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
          <View style={styles.header}>
            {kicker && <Text style={styles.kicker}>{kicker}</Text>}
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.list}>
            {options.map((opt, i) => {
              const isSelected = opt.key === selected;
              const isLast = i === options.length - 1;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onSelect(opt.key)}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    {opt.hint && <Text style={styles.rowHint}>{opt.hint}</Text>}
                  </View>
                  <View style={styles.radio}>
                    {isSelected && (
                      <Svg width={10} height={10} viewBox="0 0 10 10">
                        <Circle cx={5} cy={5} r={5} fill={C.ink} />
                      </Svg>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: C.ink },

  /* Floating sheet — inset from screen edges to match the rest of the
   * app's bottom-sheet pattern (VoiceInfoSheet, SignOutBottomSheet).
   * Full borderRadius on all four corners; shadow lifts it off the
   * backdrop. `bottom` is set inline to incorporate safe-area inset. */
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
  header: {
    paddingBottom: 14,
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

  list: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowPressed: { backgroundColor: C.cream2 },
  rowLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    color: C.ink,
  },
  rowHint: {
    marginTop: 2,
    fontFamily: 'Fraunces-Text',
    fontSize: 12,
    lineHeight: 18,
    color: C.ink3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
