/**
 * What should I call you — exact port of MBNamePick in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding.jsx
 *
 * Peach-canvas screen with:
 *   Top bar: back circle · centered "A NAME TO CALL YOU" · spacer
 *   Kicker + H1 (italic "call you") + body
 *   Name card — paper w/ 2px ink border, "HELLO, MY NAME IS" label,
 *     big Fraunces name with blinking cursor, char counter
 *   Suggestions — 6 italic chips (friend, wanderer, sunday-self, etc.)
 *   Greeting preview — lavender card showing "Good to meet you, {name}. …"
 *   Primary CTA — Continue
 *
 * Preserves existing behavior:
 *   - Google auth: extract given_name and redirect straight to questions
 *   - Email auth: interactive form, pre-fills from stored firstName
 *   - On continue: updateOnboardingData + push to /questions
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Keyboard,
  Animated as RNAnimated,
  Easing as RNEasing,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { updateOnboardingData, getOnboardingData } from '@/utils/onboardingStorage';
import { useAuth } from '@/contexts/AuthContext';

const SUGGESTIONS = ['friend', 'wanderer', 'sunday-self', 'small-one', 'me', 'dear'];
const MAX_CHARS = 30;

/** Blinking caret next to the typed name. */
function BlinkingCaret({ visible }: { visible: boolean }) {
  const opacity = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 0, duration: 520, easing: RNEasing.step0, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 1, duration: 520, easing: RNEasing.step0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, visible]);
  if (!visible) return null;
  return <RNAnimated.View style={[styles.caret, { opacity }]} />;
}

export default function NameInputScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authProvider } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [focused, setFocused]     = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Pre-fill in priority order:
    //   1. Stored answer (user already typed something this session).
    //   2. Google metadata (given_name, then first token of full_name).
    //
    // We do NOT auto-redirect for Google users any more. Earlier the
    // screen would silently `router.replace('/questions')` for any
    // signed-in Google user — turning name-input into a ghost screen
    // that forwards every visit. That broke hardware back from Q1: the
    // back handler replaces with /name-input → name-input redirects to
    // /questions → back to Q1, loop. Now the screen always renders so
    // the chain is consistent and back navigation actually works.
    //
    // The user can still edit the pre-filled name before continuing.
    let cancelled = false;
    (async () => {
      const data = await getOnboardingData();
      if (cancelled) return;
      if (data.firstName) {
        setFirstName(data.firstName);
        return;
      }
      if (authProvider === 'google' && user) {
        const meta = user.user_metadata ?? {};
        const given =
          meta.given_name ||
          ((meta.full_name ?? meta.name ?? '') as string).split(' ')[0] ||
          '';
        if (given) {
          setFirstName(given);
          await updateOnboardingData({ firstName: given }).catch(() => {});
        }
      }
    })();

    const t = setTimeout(() => inputRef.current?.focus(), 360);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [authProvider, user]);

  // Android back: dismiss keyboard FIRST so the route transition
  // doesn't leave the kbd hovering on the previous screen.
  // ALWAYS router.replace to /personalize-intro (never router.back).
  // When the user lands here via RouterGate's resume on app reopen,
  // the stack history doesn't lead to /personalize-intro, so back()
  // would send them somewhere RouterGate would just bounce back from.
  // Replace explicitly forces the right destination.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        Keyboard.dismiss();
        router.replace('/(onboarding)/personalize-intro' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router]),
  );

  const goBack = () => {
    Keyboard.dismiss();
    router.replace('/(onboarding)/personalize-intro' as any);
  };
  const canContinue = firstName.trim().length > 0;
  const handleContinue = async () => {
    if (!canContinue) return;
    await updateOnboardingData({ firstName: firstName.trim() });
    router.push('/(onboarding)/questions' as any);
  };

  const displayedName = firstName.trim();
  const charCount = firstName.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.topLabel}>A NAME TO CALL YOU</Text>
        <View style={styles.topSpacer} />
      </View>

      {/* iOS: use KAV with padding behavior. Android: rely on the native
          softwareKeyboardLayoutMode:"pan" set in app.json — KAV with
          behavior="height" on Android leaves a persistent bottom padding
          band (the "footer-like thing" that crops the CTA). */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FadingScrollWrapper bg={C.peach} topFadeHeight={24} bottomFadeHeight={32}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Intro */}
            <Text style={styles.h1}>
              First — what should I{' '}
              <Text style={styles.h1Italic}>call you</Text>?
            </Text>
            <Text style={styles.lede}>
              Your real name, a nickname, an initial. Whatever feels like you today.
            </Text>

            {/* Name card */}
            <View style={styles.nameCard}>
              <Text style={styles.nameLabel}>HELLO, MY NAME IS</Text>

              {/* Invisible TextInput sits above the visible big-serif display so taps focus it. */}
              <View style={styles.nameDisplayWrap}>
                <Text
                  style={styles.nameDisplay}
                  numberOfLines={1}
                  // Bounded shrink: iOS can scale down to 70% of 30px
                  // (≈21px) for long names, but no further. Without the
                  // minimumFontScale floor, iOS can shrink to almost
                  // invisible (the credibility-pillar bug).
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {displayedName || (
                    <Text style={[styles.nameDisplay, styles.namePlaceholder]}>your name</Text>
                  )}
                </Text>
                <BlinkingCaret visible={focused || displayedName.length > 0} />
              </View>

              <TextInput
                ref={inputRef}
                value={firstName}
                onChangeText={(t) => setFirstName(t.slice(0, MAX_CHARS))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleContinue}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                selectionColor={C.ink}
                style={styles.hiddenInput}
                maxLength={MAX_CHARS}
                placeholder=""
              />

              <Text style={styles.nameHint}>
                {charCount} OF {MAX_CHARS} CHARACTERS · ONLY YOU'LL SEE THIS
              </Text>
            </View>

            {/* Suggestions */}
            <View style={{ marginTop: 18 }}>
              <Text style={styles.kicker}>— or pick one you like the sound of</Text>
              <View style={styles.suggestionsWrap}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setFirstName(s)}
                    activeOpacity={0.75}
                    style={styles.suggestionChip}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Greeting preview */}
            <View style={styles.greetCard}>
              <Text style={styles.greetText}>
                "Good to meet you,{' '}
                <Text style={styles.greetName}>{displayedName || 'friend'}</Text>
                . Let's take this at your pace."
              </Text>
              <Text style={styles.greetKicker}>— HOW I'LL GREET YOU</Text>
            </View>
          </ScrollView>
        </FadingScrollWrapper>

        {/* Pinned footer CTA — sibling of ScrollView, still inside KAV
            so the keyboard pushes it up rather than covering it. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.cta, !canContinue && styles.ctaDisabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canContinue}
          >
            <Text style={styles.ctaText}>Continue</Text>
            <Glyphs.Arrow size={13} color={C.cream} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.peach },
  flex: { flex: 1 },

  /* Top bar */
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  topLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.ink,
  },
  topSpacer: { width: 36 },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },

  /* Intro */
  kicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  h1: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 0.3,
    color: C.ink,
  },
  h1Italic: { fontFamily: 'Fraunces-MediumItalic' },
  lede: {
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    lineHeight: 24,
    color: C.ink2,
    marginTop: 14,
    letterSpacing: 0.2,
    maxWidth: 320,
  },

  /* Name card */
  nameCard: {
    marginTop: 28,
    backgroundColor: C.paper,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.ink,
    paddingVertical: 20,
    paddingHorizontal: 22,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  nameLabel: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    letterSpacing: 2,
    color: C.ink3,
  },
  nameDisplayWrap: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  nameDisplay: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 30,
    letterSpacing: 0.3,
    color: C.ink,
    lineHeight: 38,
  },
  namePlaceholder: { color: C.ink3, fontFamily: 'Fraunces-Italic' },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    color: 'transparent',
  },
  nameHint: {
    marginTop: 14,
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.ink3,
  },
  caret: {
    width: 2,
    height: 26,
    backgroundColor: C.ink,
    marginLeft: 4,
    borderRadius: 1,
  },

  /* Suggestion chips */
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestionChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(26,31,54,0.08)',
  },
  suggestionText: {
    fontFamily: 'Fraunces-Italic',
    fontSize: 14,
    letterSpacing: 0.2,
    color: C.ink,
  },

  /* Greeting preview */
  greetCard: {
    marginTop: 20,
    backgroundColor: C.lavender,
    borderRadius: 22,
    padding: 16,
  },
  greetText: {
    fontFamily: 'Fraunces-Italic',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
    color: C.ink,
  },
  greetName: {
    fontFamily: 'Fraunces-Medium',
    fontStyle: 'normal' as const,
    color: C.ink,
  },
  greetKicker: {
    marginTop: 10,
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.lavenderDeep,
  },

  /* Pinned footer CTA */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cta: {
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.2,
  },
});
