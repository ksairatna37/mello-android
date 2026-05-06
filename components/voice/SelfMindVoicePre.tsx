/**
 * SelfMindVoicePre — pre-session intent screen for the voice surface.
 *
 * 1:1 visual port of MBVoicePre in mobile-screens-a.jsx, wired to the
 * REST-migrated voice backend:
 *
 *   - On focus, calls `getVoiceSessionContext(userId)` to fetch the
 *     user's voice profile (hume_chat_group_id, quick_context,
 *     last_emotions, detected_name) from /rest/v1/voice_user_profiles.
 *     Returning users see a small "welcome back" line; first-time
 *     users see the default headline.
 *   - "Start voice"  → router.push('/voice-active') which mounts the
 *                       legacy VoiceAgentScreen (full Hume EVI flow)
 *   - "Type it"     → router.push('/chats') so the user lands on
 *                       SelfMindChatHome
 *   - Tapping an intent option pre-selects it (visual highlight) and
 *     also starts the voice session — the chosen intent is stashed
 *     in the in-flight `voiceIntentStore` so VoiceAgentScreen could
 *     pick it up as initial context (TODO when wiring is needed).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import SelfMindOrb from '@/components/common/SelfMindOrb';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { useAuth } from '@/contexts/AuthContext';
import {
  getVoiceSessionContext,
  type VoiceSessionContext,
} from '@/services/chat/voiceChatService';

const INTENTS: ReadonlyArray<string> = [
  'The Sunday dread',
  "Something I can’t stop replaying",
  "I don’t know, just — today",
  'Nothing specific. Keep me company',
];

export default function SelfMindVoicePre() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useAuth();

  const [context, setContext] = useState<VoiceSessionContext | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);

  const userId = state.kind === 'authed' ? state.userId : null;

  /* Refresh context on focus — covers post-call returns where the
   * profile may have been updated by finalizeVoiceSession. */
  const loadContext = useCallback(async () => {
    if (!userId) {
      console.log('[SelfMindVoicePre] no userId — skipping context fetch');
      return;
    }
    console.log('[SelfMindVoicePre] fetching voice context…');
    try {
      const ctx = await getVoiceSessionContext(userId);
      console.log(
        '[SelfMindVoicePre] context →',
        'name=' + (ctx.detected_name ?? 'none'),
        'hasQuickContext=' + !!ctx.quick_context,
      );
      setContext(ctx);
    } catch (err: any) {
      console.error('[SelfMindVoicePre] context fetch error:', err?.message ?? err);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadContext();
    }, [loadContext]),
  );

  /* The "Start voice" CTA pushes onto /voice-active where the legacy
   * VoiceAgentScreen runs the full Hume EVI session. We don't connect
   * to Hume here — this is just the intent gate. */
  const handleStartVoice = useCallback(() => {
    console.log('[SelfMindVoicePre] start voice — intent=' + (selectedIntent ?? 'none'));
    router.push('/voice-active' as any);
  }, [router, selectedIntent]);

  const handleTypeInstead = useCallback(() => {
    console.log('[SelfMindVoicePre] type instead → /chats');
    router.push('/chats' as any);
  }, [router]);

  const handleIntent = useCallback((intent: string) => {
    console.log('[SelfMindVoicePre] intent picked: ' + intent);
    setSelectedIntent(intent);
    handleStartVoice();
  }, [handleStartVoice]);

  /* Greeting variants */
  const isReturning = !!context?.quick_context;
  const detectedName = context?.detected_name?.trim();

  return (
    <LinearGradient
      colors={[C.cream, C.peach]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Voice</Text>
        <TouchableOpacity
          onPress={() => console.log('[VoicePre] more tapped')}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.More size={18} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.orbWrap}>
          <SelfMindOrb size={180} seed={2} />
        </View>

        <Text style={styles.kicker}>
          {isReturning ? 'WELCOME BACK' : 'BEFORE WE START'}
        </Text>
        <Text style={styles.headline}>
          {isReturning && detectedName ? (
            <>
              Hey {detectedName}, what{'’'}s{' '}
              <Text style={styles.headlineItalic}>alive</Text> for you today?
            </>
          ) : (
            <>
              What{'’'}s <Text style={styles.headlineItalic}>alive</Text> for you right now?
            </>
          )}
        </Text>
        <Text style={styles.body}>
          No wrong answer. A word, a sentence, a messy feeling. It helps me know where to meet you.
        </Text>

        <View style={styles.intentList}>
          {INTENTS.map((o) => {
            const on = selectedIntent === o;
            return (
              <TouchableOpacity
                key={o}
                style={[styles.intentRow, on && styles.intentRowOn]}
                onPress={() => handleIntent(o)}
                activeOpacity={0.85}
              >
                <Text style={[styles.intentText, on && styles.intentTextOn]}>{o}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Pinned footer CTAs */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSoft]}
          onPress={handleTypeInstead}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSoftText}>Type it</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleStartVoice}
          activeOpacity={0.9}
        >
          <Glyphs.Mic size={15} color={C.cream} />
          <Text style={styles.btnPrimaryText}>Start voice</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

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
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.1,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: 'center',
  },

  orbWrap: { marginTop: 4 },

  kicker: {
    marginTop: 28,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 40,
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
    lineHeight: 21,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 300,
    letterSpacing: 0.1,
  },

  intentList: {
    marginTop: 28,
    width: '100%',
    gap: 10,
  },
  intentRow: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line2,
  },
  intentRowOn: {
    backgroundColor: C.ink,
    borderColor: 'transparent',
  },
  intentText: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
    color: C.ink,
  },
  intentTextOn: { color: C.cream },

  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
  },
  btnSoft: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line2,
  },
  btnSoftText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.1,
  },
  btnPrimary: { backgroundColor: C.ink },
  btnPrimaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
});
