/**
 * SelfMindBoxBreathCrisisReturn — soft transitional screen after a
 * box-breath session that started from the crisis page.
 *
 * Distinct from `SelfMindBoxBreathSummary`:
 *   - No stats card (counts feel performative in a crisis frame).
 *   - No save-this-practice heart (saving is a normal-day affordance).
 *   - No "notice what feels softer" — that's a journal-state prompt;
 *     not where this user is right now.
 *   - Cream surface (not peach) — neutral, not celebratory.
 *   - Single ink CTA: "Back to resources" → /chat. ChatScreen's
 *     `crisisResumeStore.consume()` re-opens the crisis page.
 *
 * Only shown when cycles >= 4. Below that, /box-breath skips the
 * interstitial entirely and replaces directly to /chat.
 *
 * Why a separate component: the regular summary's tone (peach + "All
 * twelve" + reflection prompts) is right for a self-care choice the
 * user made on a normal day. In crisis, the right beat is a brief
 * acknowledgement and a hand back to the resources, not a moment of
 * celebration.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import SelfMindOrb from '@/components/common/SelfMindOrb';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

export default function SelfMindBoxBreathCrisisReturn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = useCallback(() => {
    console.log('[BoxBreathCrisisReturn] back to /chat');
    router.replace('/chat' as any);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.body, {
        paddingTop: insets.top + 80,
        paddingBottom: insets.bottom + 24,
      }]}>
        <View style={{ alignItems: 'center' }}>
          <SelfMindOrb size={140} seed={9} />
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.kicker}>— a breath, taken</Text>
          <Text style={styles.headline}>
            <Text style={styles.headlineItalic}>Easy now</Text>.{'\n'}
            The resources are still here.
          </Text>
          <Text style={styles.body2}>
            Whatever you decide next, you don{'’'}t have to decide alone.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={handleBack}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaText}>Back to resources</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  copyWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 16,
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.3,
    color: C.ink,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  body2: {
    marginTop: 16,
    fontFamily: 'Fraunces-Text',
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: 0.15,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 300,
  },

  cta: {
    backgroundColor: C.ink,
    borderRadius: RADIUS.btn,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.2,
  },
});
