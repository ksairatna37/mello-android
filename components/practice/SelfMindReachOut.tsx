/**
 * SelfMindReachOut — rehearse a message before sending.
 *
 * UX pattern: tone-driven draft generator. The user names a recipient
 * + what's on their mind, picks a tone (warm / honest / boundaried /
 * playful), and sees three pre-baked drafts in that voice as a
 * horizontal pager. Each card has Copy + Share affordances.
 *
 * Distinct from other practice screens by: horizontal pager of full
 * draft cards (not chip grid, not timer, not slot composition). Tone
 * pill row drives which template set renders.
 *
 * No backend / LLM call yet — drafts are hand-written templates that
 * substitute {recipient} and {topic} slots. Robust + offline; can be
 * upgraded later to a model-generated set when we have a generation
 * endpoint without the god-table mess.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Share,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import SavePracticeButton from './SavePracticeButton';
import { generateMessageDrafts } from '@/services/chat/bedrockService';

type Tone = 'warm' | 'honest' | 'boundaried' | 'playful';
const TONES: ReadonlyArray<{ id: Tone; label: string; swatch: string }> = [
  { id: 'warm',       label: 'warm',       swatch: C.peach    },
  { id: 'honest',     label: 'honest',     swatch: C.lavender },
  { id: 'boundaried', label: 'boundaried', swatch: C.sage     },
  { id: 'playful',    label: 'playful',    swatch: C.butter   },
];

type Templates = Record<Tone, ReadonlyArray<(r: string, t: string) => string>>;
const TEMPLATES: Templates = {
  warm: [
    (r, t) => `hey ${r || 'you'} — been thinking about you. ${t || 'wanted to check in'}. no rush to reply, just wanted you to know.`,
    (r, t) => `${r || 'hi'}, ${t || 'something soft'}. tell me when you have a quiet five.`,
    (r, t) => `${r || 'you'} — i was going to write something long, but i'll just say: ${t || 'i miss you'}.`,
  ],
  honest: [
    (r, t) => `${r || 'hey'}, i want to be straight with you: ${t || 'this has been weighing on me'}. can we talk?`,
    (r, t) => `${r || 'you'} — i'm sitting with ${t || 'something i need to say'}. i'd rather we hear it from each other than around it.`,
    (r, t) => `${r || 'hi'}. ${t || 'this is the truth as i see it'}. open to where you land.`,
  ],
  boundaried: [
    (r, t) => `${r || 'hey'} — i can't take this on right now. ${t || "i'd rather not get into it tonight"}. talk soon.`,
    (r, t) => `${r || 'hi'}, i need a minute on ${t || 'this'}. i'll come back when i have a real answer.`,
    (r, t) => `${r || 'you'} — ${t || "this isn't a yes from me right now"}. not a forever no, just a now no.`,
  ],
  playful: [
    (r, t) => `${r || 'oi'} — ${t || 'random'} but i thought of you.`,
    (r, t) => `${r || 'hello hello'}. ${t || "i'm writing this in line for coffee"}. say hi back when you can.`,
    (r, t) => `${r || 'you'}: ${t || 'a small good thing happened'}. that's the whole text.`,
  ],
};

const CARD_WIDTH_FRACTION = 0.86;

export default function SelfMindReachOut() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('warm');
  /* AI drafts replace the hand-written templates once Bedrock returns.
   * Falls back to templates when the call fails or returns empty —
   * never leaves the user staring at a blank list. */
  const [aiDrafts, setAiDrafts] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);

  /* Pulse for skeleton placeholders while drafts are generating. */
  const pulseOpacity = useSharedValue(0.5);
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulseOpacity]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  /* Debounced regenerate — fires when tone, recipient, or topic
   * changes. 600ms debounce keeps a fast typer from spamming Bedrock
   * on every keystroke. The cancellation flag drops in-flight results
   * if a newer keystroke fired in the meantime. */
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      console.log('[ReachOut] generating drafts · tone=' + tone + ' nameLen=' + recipient.trim().length + ' topicLen=' + topic.trim().length);
      setGenerating(true);
      const drafts = await generateMessageDrafts({
        intent: 'reach-out',
        tone,
        recipient: recipient.trim(),
        topic: topic.trim(),
        count: 3,
      });
      if (cancelled) return;
      if (drafts.length > 0) setAiDrafts(drafts);
      else {
        console.warn('[ReachOut] AI drafts empty — using static fallback');
        setAiDrafts(null);
      }
      setGenerating(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tone, recipient, topic]);

  /* Final list rendered to the pager — AI when present, otherwise
   * the deterministic templates so the surface always has content. */
  const drafts = useMemo<string[]>(
    () => aiDrafts ?? TEMPLATES[tone].map((fn) => fn(recipient.trim(), topic.trim())),
    [aiDrafts, tone, recipient, topic],
  );

  const handleClose = useCallback(() => {
    router.replace('/practice' as any);
  }, [router]);

  const handleCopyShare = useCallback(async (draft: string) => {
    try {
      await Share.share({ message: draft });
    } catch (err) {
      console.warn('[ReachOut] share failed', err);
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleClose} style={styles.iconBtn} activeOpacity={0.85} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Reach out</Text>
        <SavePracticeButton practiceId="reach-out" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>— rehearse before you send</Text>
            <Text style={styles.headline}>
              What do you want them to <Text style={styles.headlineItalic}>hear</Text>?
            </Text>

            {/* Inputs */}
            <View style={styles.inputCard}>
              <Text style={styles.fieldLabel}>WHO</Text>
              <TextInput
                style={styles.input}
                value={recipient}
                onChangeText={setRecipient}
                placeholder="their name (or how you'd start)"
                placeholderTextColor={C.ink3}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputCard}>
              <Text style={styles.fieldLabel}>WHAT</Text>
              <TextInput
                style={styles.input}
                value={topic}
                onChangeText={setTopic}
                placeholder="a few words about what's on your mind"
                placeholderTextColor={C.ink3}
                multiline
                returnKeyType="done"
              />
            </View>

            {/* Tone picker */}
            <Text style={[styles.kicker, { marginTop: 22 }]}>— pick a tone</Text>
            <View style={styles.toneRow}>
              {TONES.map((t) => {
                const on = tone === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.toneChip,
                      { backgroundColor: t.swatch },
                      on && styles.toneChipOn,
                    ]}
                    onPress={() => setTone(t.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.toneChipText}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Draft pager — horizontal swipe, snap-to-card.
             * Shows skeleton placeholders while Bedrock is generating. */}
            <Text style={[styles.kicker, { marginTop: 22 }]}>
              — {generating ? 'writing drafts in your voice…' : 'three drafts · swipe'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={Math.round(360 * CARD_WIDTH_FRACTION) + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.draftRow}
            >
              {generating && !aiDrafts ? (
                [0, 1, 2].map((i) => (
                  <Animated.View key={'skel-' + i} style={[styles.draftCard, pulseStyle]}>
                    <View style={styles.skelLine} />
                    <View style={[styles.skelLine, { marginTop: 8, width: '90%' }]} />
                    <View style={[styles.skelLine, { marginTop: 8, width: '60%' }]} />
                  </Animated.View>
                ))
              ) : drafts.map((d, i) => (
                <View key={tone + i} style={styles.draftCard}>
                  <Text style={styles.draftIndex}>0{i + 1} / 0{drafts.length}</Text>
                  <Text style={styles.draftText}>{d}</Text>
                  <TouchableOpacity style={styles.shareBtn} onPress={() => handleCopyShare(d)} activeOpacity={0.85}>
                    <Text style={styles.shareBtnText}>Share this draft</Text>
                    <Glyphs.Arrow size={12} color={C.ink} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.tinyHint}>
              tap a draft to share — nothing leaves your phone until you do.
            </Text>
          </ScrollView>
        </FadingScrollWrapper>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 10, elevation: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: 'Fraunces-Medium', fontSize: 17, color: C.ink, letterSpacing: -0.1 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium', fontSize: 11, letterSpacing: 2.2, color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium', fontSize: 32, lineHeight: 40,
    letterSpacing: -0.3, color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  inputCard: {
    marginTop: 14,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  fieldLabel: {
    fontFamily: 'JetBrainsMono-Medium', fontSize: 9.5, letterSpacing: 1.6, color: C.ink3,
  },
  input: {
    marginTop: 4,
    fontFamily: 'Fraunces-Text', fontSize: 16, color: C.ink, letterSpacing: 0.15,
  },

  toneRow: {
    marginTop: 10,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  toneChip: {
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2, borderColor: 'transparent',
  },
  toneChipOn: { borderColor: C.ink },
  toneChipText: {
    fontFamily: 'Fraunces-Medium', fontSize: 14, color: C.ink, letterSpacing: -0.05,
  },

  draftRow: {
    paddingTop: 12, paddingBottom: 6,
    gap: 12,
  },
  draftCard: {
    width: Math.round(360 * CARD_WIDTH_FRACTION),
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.line,
    padding: 18,
  },
  draftIndex: {
    fontFamily: 'JetBrainsMono-Medium', fontSize: 10, letterSpacing: 1.8, color: C.ink3,
  },
  draftText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text', fontSize: 16, lineHeight: 24,
    color: C.ink, letterSpacing: 0.15,
  },
  shareBtn: {
    marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    backgroundColor: C.cream2,
    borderRadius: 999,
    borderWidth: 1, borderColor: C.line2,
  },
  shareBtnText: {
    fontFamily: 'Inter-Medium', fontSize: 13, color: C.ink, letterSpacing: 0.1,
  },

  /* Skeleton placeholder line — used inside draftCard while Bedrock
   * is generating. Pulse animation lives on the wrapping card. */
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(26,31,54,0.10)',
    width: '100%',
  },

  tinyHint: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text-Italic', fontSize: 12, lineHeight: 16,
    color: C.ink3, textAlign: 'center', letterSpacing: 0.1,
  },
});
