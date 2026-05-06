/**
 * SelfMindVoiceLimit — soft paywall surface.
 *
 * 1:1 port of MBVoiceLimit in mobile-screens-a.jsx. Currently STATIC —
 * subscription / billing isn't wired up yet. The "Start 7-day trial"
 * CTA will route through the App Store / Play Store flow once those
 * are added; for now it's a placeholder that closes the screen.
 *
 * Used as the paywall when the free-session counter exceeds the
 * weekly limit (TODO: wire to voice_user_profiles.total_sessions
 * when limits are decided server-side).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';

const BENEFITS: ReadonlyArray<string> = [
  'Unlimited voice + chat',
  'Weekly reflection summaries',
  'Mood trends across months',
  'Priority on crisis support',
];

export default function SelfMindVoiceLimit() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleClose = () => router.back();

  const handleStartTrial = () => {
    console.log('[VoiceLimit] start trial tapped — billing flow not wired yet');
    Alert.alert(
      'Coming soon',
      'Subscription billing isn’t wired up yet — try again in a future build.',
    );
  };

  const handleWait = () => router.back();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar — close (X) on right */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topSide} />
        <View style={styles.topSide} />
        <TouchableOpacity
          onPress={handleClose}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Close size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={32} bg={C.cream2}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 40 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
        {/* Hero — butter circle with moon */}
        <View style={styles.heroCircle}>
          <Glyphs.Moon size={42} color={C.ink} />
        </View>

        <Text style={styles.kicker}>
          YOU'VE USED YOUR 3 FREE SESSIONS THIS WEEK
        </Text>
        <Text style={styles.headline}>
          You{'’'}ve been{' '}
          <Text style={styles.headlineItalic}>showing up</Text>.
        </Text>
        <Text style={styles.body}>
          That matters. If you want unlimited conversations, deeper summaries, and a companion that remembers you week to week — the door{'’'}s open.
        </Text>

        {/* Plan card */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>
              SelfMind <Text style={styles.planNameItalic}>Plus</Text>
            </Text>
            <Text style={styles.planPrice}>
              $9<Text style={styles.planPriceUnit}>/mo</Text>
            </Text>
          </View>
          <View style={styles.benefitList}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <Glyphs.Check size={14} color={C.coral} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTAs */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartTrial}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>Start 7-day trial</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.waitBtn}
          onPress={handleWait}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.waitText}>OR WAIT UNTIL MONDAY</Text>
        </TouchableOpacity>
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream2 },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSide: { width: 36, height: 36 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },

  heroCircle: {
    marginTop: 20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.butter,
    alignItems: 'center', justifyContent: 'center',
  },

  kicker: {
    marginTop: 28,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textAlign: 'center',
    maxWidth: 300,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.3,
    color: C.ink,
    textAlign: 'center',
    maxWidth: 300,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body: {
    marginTop: 14,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 22,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 300,
    letterSpacing: 0.1,
  },

  /* Plan card */
  planCard: {
    marginTop: 24,
    width: '100%',
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: RADIUS.card,
    padding: 22,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  planName: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    letterSpacing: -0.2,
    color: C.ink,
  },
  planNameItalic: { fontFamily: 'Fraunces-MediumItalic' },
  planPrice: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 22,
    color: C.ink,
  },
  planPriceUnit: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.ink3,
  },
  benefitList: {
    marginTop: 14,
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  primaryBtn: {
    marginTop: 18,
    width: '100%',
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.2,
  },
  waitBtn: {
    marginTop: 12,
    paddingVertical: 8,
  },
  waitText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.4,
    color: C.ink3,
    textAlign: 'center',
  },
});
