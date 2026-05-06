/**
 * SelfMindChatCrisis — full-surface crisis pause.
 *
 * 1:1 port of MBChatCrisis in mobile-screens-a.jsx. Triggered by the
 * shared `detectCrisis()` keyword scan in `ChatScreen.handleSend`.
 *
 * Layout (top-down):
 *   - Top bar: title "We're here" + close (X) on the right.
 *   - Ink card: pulsing coral dot + mono "gently pausing the chat",
 *     then a Fraunces line "Something you said landed heavy. I want
 *     to stay with you." + a paragraph that names the limit ("I'm not
 *     the right kind of help right now. A real human who does this
 *     every day is.").
 *   - Three resource cards (coral / lavender / sage):
 *     * Call 988  — Suicide & Crisis Lifeline (free · 24/7 · calls or texts)
 *     * Text HOME to 741741 — Crisis Text Line
 *     * Tell someone you trust — routes to /reach-out (the rehearsal
 *       practice we already built)
 *   - Dashed-border italic footer: a calm "I'll be here when you're
 *     ready" note signed by SelfMind.
 *
 * Voice rules (per page-design.md): no exclamations, no clinical
 * jargon, no emoji. The tone is held by typography (Fraunces italic
 * emphasis on "I want to stay with you") and color contrast (ink
 * card on cream, coral/lavender/sage tone cards).
 *
 * Triggered as a Modal so it always layers above the keyboard,
 * input bar, and the dimmed chat background. Backdrop tap and the
 * close (X) both dismiss; "Tell someone" routes via expo-router and
 * also dismisses.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { CRISIS_RESOURCES } from '@/utils/crisisDetection';
import { crisisResumeStore } from '@/utils/crisisResumeStore';
import { recordCrisisFlowEvent } from '@/services/chat/liveContextInjection';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SelfMindChatCrisis({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /* In-tree overlay (not a native Modal) so the navigation stack can
   * slide a side-flow screen ON TOP of it. A native Modal floats above
   * the React Navigation stack window, which caused a chat-flash during
   * crisis → side-flow transitions. We keep the overlay mounted while
   * navigating; the new screen covers it. On return, it's already
   * there — no re-show animation needed. */
  const [mounted, setMounted] = useState(visible);
  const fade = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      fade.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      fade.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [visible]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  /* Pulsing coral dot — slow, calm, NOT alarming. */
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.9);
  useEffect(() => {
    if (!visible) return;
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.95, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [visible, pulseScale, pulseOpacity]);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handleCallICall = useCallback(() => {
    console.log('[Crisis] tap → iCall');
    recordCrisisFlowEvent('opened-icall-helpline');
    Linking.openURL(CRISIS_RESOURCES.iCall.url).catch((err) =>
      console.warn('[Crisis] iCall tel link failed:', err),
    );
  }, []);

  const handleCallKiran = useCallback(() => {
    console.log('[Crisis] tap → KIRAN 24x7');
    recordCrisisFlowEvent('opened-kiran-helpline');
    Linking.openURL(CRISIS_RESOURCES.kiran.url).catch((err) =>
      console.warn('[Crisis] KIRAN tel link failed:', err),
    );
  }, []);

  const handleTellSomeone = useCallback(() => {
    console.log('[Crisis] tap → /tell-someone (vulnerable drafts)');
    recordCrisisFlowEvent('opened-tell-someone');
    crisisResumeStore.set();
    /* Do NOT close the overlay before navigating — leaving it mounted
     * lets the navigation stack slide /tell-someone in on top with no
     * chat-flash. On return, the overlay is still there. */
    router.push('/tell-someone' as any);
  }, [router]);

  /* Box-breath side-flow — leave the crisis overlay mounted, push to
   * /box-breath with from=crisis so the player + summary know where to
   * return to. crisisResumeStore is still set as a belt-and-braces so
   * external entry points can also resurface the crisis page. */
  const handleBoxBreath = useCallback(() => {
    console.log('[Crisis] tap → box breath, will resume crisis on return');
    recordCrisisFlowEvent('started-box-breath');
    crisisResumeStore.set();
    router.push('/box-breath?from=crisis' as any);
  }, [router]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.container, overlayStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.fill}>
        {visible && <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />}

        {/* Top bar — back chevron (resume chat) · title · close (X) */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconBtn}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Back to chat"
          >
            <Glyphs.Back size={18} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>
            We<Text>’</Text>re here
          </Text>
          {/* Invisible spacer keeps the title centered now that the
           * redundant close (X) is gone — back chevron alone resumes
           * the chat. Width matches `iconBtn` (36) so layout is even. */}
          <View style={styles.topBarSpacer} />
        </View>

        <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Ink card — naming the pause */}
            <View style={styles.inkCard}>
              <View style={styles.dotRow}>
                <Animated.View style={[styles.dot, dotStyle]} />
                <Text style={styles.dotLabel}>GENTLY PAUSING THE CHAT</Text>
              </View>
              <Text style={styles.headline}>
                Something you said landed{' '}
                <Text style={styles.headlineSoft}>heavy</Text>.{'\n'}
                <Text style={styles.headlineItalic}>I want to stay with you</Text>.
              </Text>
              <Text style={styles.body}>
                If you{'’'}re thinking about hurting yourself or ending your life,
                I{'’'}m not the right kind of help right now. A real human who
                does this every day is.
              </Text>
            </View>

            {/* Resource cards — India helplines */}
            <View style={styles.cards}>
              <TouchableOpacity
                style={[styles.resourceCard, { backgroundColor: C.coral }]}
                onPress={handleCallICall}
                activeOpacity={0.9}
              >
                <View style={styles.iconBadge}>
                  <Glyphs.Heart size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resourceTitle}>Call iCall</Text>
                  <Text style={styles.resourceSub}>
                    9152987821{'  ·  '}free counseling, 8am–10pm
                  </Text>
                </View>
                <Glyphs.Arrow size={14} color={C.ink} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resourceCard, { backgroundColor: C.lavender }]}
                onPress={handleCallKiran}
                activeOpacity={0.9}
              >
                <View style={styles.iconBadge}>
                  <Glyphs.Chat size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resourceTitle}>KIRAN — 24/7 helpline</Text>
                  <Text style={styles.resourceSub}>
                    1800-599-0019{'  ·  '}free, multilingual, govt of india
                  </Text>
                </View>
                <Glyphs.Arrow size={14} color={C.ink} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resourceCard, { backgroundColor: C.sage }]}
                onPress={handleTellSomeone}
                activeOpacity={0.9}
              >
                <View style={styles.iconBadge}>
                  <Glyphs.Heart size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resourceTitle}>Tell someone you trust</Text>
                  <Text style={styles.resourceSub}>
                    we{'’'}ll help you draft the message
                  </Text>
                </View>
                <Glyphs.Arrow size={14} color={C.ink} />
              </TouchableOpacity>
            </View>

            {/* Suggested side-flow — a short breath practice while the
             * user decides. Distinct visual treatment (peach + small
             * kicker) so it reads as gentle suggestion, not a primary
             * crisis action. End / back returns to this page. */}
            <TouchableOpacity
              style={styles.breathCard}
              onPress={handleBoxBreath}
              activeOpacity={0.92}
            >
              <View style={styles.breathOrb} pointerEvents="none" />
              <Text style={styles.breathKicker}>WHILE YOU SIT WITH IT</Text>
              <Text style={styles.breathTitle}>
                Try a few <Text style={styles.breathTitleItalic}>slow breaths</Text>.
              </Text>
              <Text style={styles.breathSub}>
                4 in · 4 hold · 4 out · 4 hold. We{'’'}ll come right back here.
              </Text>
              <View style={styles.breathBtn}>
                <Text style={styles.breathBtnText}>Start box breath</Text>
                <Glyphs.Arrow size={12} color={C.cream} />
              </View>
            </TouchableOpacity>

            {/* Soft footer note — dashed border, italic */}
            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>
                I{'’'}ll be here when you{'’'}re ready to come back.
                No pressure, no judgment.{'  '}
                <Text style={styles.footerSign}>— SelfMind</Text>
              </Text>
            </View>
          </ScrollView>
        </FadingScrollWrapper>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Full-screen in-tree overlay — sits above ChatScreen content but
   * below any expo-router screens pushed on top of /chat. */
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.cream,
    zIndex: 100,
    elevation: 100,
  },
  fill: { flex: 1 },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarSpacer: { width: 36, height: 36 },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  /* Ink card */
  inkCard: {
    marginTop: 12,
    backgroundColor: C.ink,
    borderRadius: RADIUS.card,
    padding: 22,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.coral,
  },
  dotLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.8,
    color: 'rgba(251,245,238,0.7)',
  },
  headline: {
    marginTop: 16,
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: C.cream,
  },
  headlineSoft: {
    color: C.cream,
  },
  headlineItalic: {
    fontFamily: 'Fraunces-MediumItalic',
  },
  body: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 21,
    color: 'rgba(251,245,238,0.78)',
    letterSpacing: 0.15,
  },

  /* Resource cards */
  cards: {
    marginTop: 16,
    gap: 10,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: RADIUS.card,
  },
  numberBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  numberBadgeText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 13,
    letterSpacing: 0.5,
    color: C.cream,
  },
  iconBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.paper,
    alignItems: 'center', justifyContent: 'center',
  },
  resourceTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  resourceSub: {
    marginTop: 3,
    fontFamily: 'Fraunces-Text',
    fontSize: 12,
    color: C.ink2,
    letterSpacing: 0.15,
  },

  /* Box-breath suggested card — peach surface, small kicker, soft
   * orb in the corner, primary "Start" pill. */
  breathCard: {
    marginTop: 16,
    backgroundColor: C.peach,
    borderRadius: RADIUS.card,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  breathOrb: {
    position: 'absolute',
    right: -28, top: -28,
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  breathKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink2,
  },
  breathTitle: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: C.ink,
  },
  breathTitleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  breathSub: {
    marginTop: 8,
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    lineHeight: 18,
    color: C.ink2,
    maxWidth: 260,
    letterSpacing: 0.15,
  },
  breathBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.btn,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breathBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.cream,
    letterSpacing: 0.1,
  },

  /* Footer note */
  footerNote: {
    marginTop: 22,
    padding: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line2,
    borderRadius: 18,
  },
  footerNoteText: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13,
    lineHeight: 20,
    color: C.ink2,
    letterSpacing: 0.15,
  },
  footerSign: {
    fontFamily: 'Fraunces-Medium',
    fontStyle: 'normal',
    color: C.ink,
  },
});
