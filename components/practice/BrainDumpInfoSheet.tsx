/**
 * BrainDumpInfoSheet — explains the three buckets in plain language.
 *
 * Animation/contract cloned from DeleteChatSheet (paper card, 32-radius,
 * spring-in / timing-out). Same backdrop, same offset, same handle bar.
 * Differs in body: instead of a destructive confirm, it lists the
 * three category rows (colored dot + label + one-line meaning) and a
 * single "Got it" dismiss pill.
 *
 * Bucket meanings are deliberately written in lowercase, soft voice
 * (CBT/ACT-tuned — see SelfMindBrainDump.tsx for the clinical
 * rationale behind the rename from urgent/later/decide → soon/park/sit).
 */

import React, { useCallback, useEffect } from 'react';
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

interface BrainDumpInfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ROWS: ReadonlyArray<{ key: string; dot: string; label: string; body: string }> = [
  {
    key: 'soon',
    dot: C.coral,
    label: 'do soon',
    body: 'a real thing you can do in the next day or so. a reply, a small task, something with a clear next step.',
  },
  {
    key: 'park',
    dot: C.lavender,
    label: 'park it',
    body: 'a real to-do, but it can wait. days, weeks — fine. permission to put it down for now.',
  },
  {
    key: 'sit',
    dot: C.butter,
    label: 'sit with',
    body: 'a question, doubt, or loop. nothing to solve right now — these are thoughts to notice, not problems to fix.',
  },
];

export default function BrainDumpInfoSheet({ visible, onClose }: BrainDumpInfoSheetProps) {
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
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [visible]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 280 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

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
            <View style={styles.iconWrap}>
              <Glyphs.Info size={22} color={C.coral} />
            </View>

            <Text style={styles.kicker}>— how we sort thoughts</Text>
            <Text style={styles.title}>
              Three soft <Text style={styles.titleItalic}>buckets</Text>.
            </Text>
            <Text style={styles.subtitle}>
              Every thought you type lands in one of these. tap a thought later to move it.
            </Text>

            <View style={styles.rows}>
              {ROWS.map((r, i) => (
                <View key={r.key}>
                  <View style={styles.row}>
                    <View style={[styles.rowDot, { backgroundColor: r.dot }]} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel}>{r.label}</Text>
                      <Text style={styles.rowBody}>{r.body}</Text>
                    </View>
                  </View>
                  {i < ROWS.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.gotItBtn} onPress={handleClose} activeOpacity={0.9}>
              <Text style={styles.gotItBtnText}>Got it</Text>
            </TouchableOpacity>
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
    marginTop: 10,
    marginBottom: 18,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 20,
    color: C.ink2,
    textAlign: 'center',
    letterSpacing: 0.15,
    paddingHorizontal: 6,
  },

  /* Bucket rows — color dot + label + plain-language body. */
  rows: {
    width: '100%',
    backgroundColor: C.cream,
    borderRadius: RADIUS.card,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  rowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 23,
    color: C.ink,
    letterSpacing: -0.1,
  },
  rowBody: {
    marginTop: 4,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 19,
    color: C.ink2,
    letterSpacing: 0.15,
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.line,
    marginLeft: 22,
  },

  gotItBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    backgroundColor: C.ink,
  },
  gotItBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.2,
  },
});
