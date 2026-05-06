/**
 * SelfMindTellSomeone — words for asking for help when they're hard to find.
 *
 * Reached only from the crisis page ("Tell someone you trust" card).
 * Distinct from the everyday `/reach-out` rehearsal practice:
 *
 *   - No tone picker. There's one mode here: vulnerable, presence-asking.
 *     Picking a vibe is for normal-day connection, not now.
 *   - Three pre-written messages visible immediately. No sub-navigation.
 *     Read in one scan, tap one, share.
 *   - Tone of templates: "could we talk", "would you sit with me",
 *     "I need someone tonight" — soft, low-cost asks that the recipient
 *     can say yes to without bracing for impact. NOT direct disclosure
 *     ("I'm having suicidal thoughts") — the helplines are for that level.
 *   - Optional name field. Personalises the templates so they read as
 *     the user's voice, not a script. Optional — they can tap a card
 *     without typing.
 *   - Share via native iOS/Android sheet — opens iMessage / WhatsApp /
 *     etc. with the text editable, so the user can soften, expand, or
 *     adjust before sending. Most apps auto-fill the To: field if the
 *     user picks a recipient inside the share sheet.
 *   - Tiny footer affordance routing to iCall — quiet alternative
 *     without making the user back out of this surface.
 *
 * Round-trip: when the user taps Back, the crisisResumeStore is set
 * (same pattern as box-breath) so /chat re-opens the crisis page on
 * focus — they land back in the resource list they came from.
 *
 * Voice rules (per page-design.md): no exclamations, no "you're
 * worth it" reassurance, no clinical jargon, no emoji. Lowercase
 * vulnerability is the tone. Italic emphasis carries the weight.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { crisisResumeStore } from '@/utils/crisisResumeStore';
import { crisisContextStore } from '@/utils/crisisContextStore';
import { generateMessageDrafts } from '@/services/chat/bedrockService';
import { recordCrisisFlowEvent } from '@/services/chat/liveContextInjection';

interface Draft {
  id: string;
  swatch: string;
  /** Returns the formatted message for share. `name` may be empty. */
  build: (name: string) => string;
  /** Preview text shown in the card — uses {name} placeholder. */
  preview: string;
}

const DRAFTS: ReadonlyArray<Draft> = [
  {
    id: 'check-in',
    swatch: C.peach,
    preview: 'Hi {name}. I’m not okay tonight. Could we talk for a minute?',
    build: (n) => {
      const greeting = n ? `Hi ${n}.` : 'Hi.';
      return `${greeting} I’m not okay tonight. Could we talk for a minute?`;
    },
  },
  {
    id: 'sit-with',
    swatch: C.lavender,
    preview: '{name} — I’m struggling and I don’t want to be alone right now. Are you free?',
    build: (n) => {
      const head = n ? `${n} — ` : '';
      return `${head}I’m struggling and I don’t want to be alone right now. Are you free?`;
    },
  },
  {
    id: 'just-a-few',
    swatch: C.sage,
    preview: 'I need someone tonight, {name}. Just a few minutes, no pressure.',
    build: (n) => {
      const tail = n ? `, ${n}` : '';
      return `I need someone tonight${tail}. Just a few minutes, no pressure.`;
    },
  },
];

/** Replace `{name}` placeholder for the on-card preview. */
function previewFor(d: Draft, name: string): string {
  if (!name) return d.preview.replace(/\s*\{name\}/g, '').replace(/\s+—\s+/g, '').replace(/^,\s+/, '').trim();
  return d.preview.replace(/\{name\}/g, name);
}

/** Build a fallback draft from the static template if Bedrock fails. */
function fallbackBuild(d: Draft, name: string): string {
  return d.build(name);
}

const SWATCHES = [C.peach, C.lavender, C.sage] as const;

export default function SelfMindTellSomeone() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState('');
  /* Drafts source-of-truth: starts from the static templates rendered
   * with current name, then gets replaced by Bedrock-generated drafts
   * once the call returns. We also re-fetch when the name changes (so
   * the AI can write the recipient in naturally instead of us
   * substituting placeholders). */
  const [aiDrafts, setAiDrafts] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  /* Per-draft tweak state — when a draft is being tweaked, its index
   * is in `editingIdx` and the user-edited text lives in `editedText`.
   * Sending a tweaked draft uses the edited text; otherwise the
   * original draft string is sent. */
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<Record<number, string>>({});

  /* Conversation snippet captured by ChatScreen on crisis detection.
   * Snapshot once on mount — the chat we came from doesn't change while
   * we're on this screen, and re-reading on every render would mean
   * peek() racing with potential clears elsewhere. */
  const [contextSnippet] = useState(() => crisisContextStore.peek());
  const conversationContext = useMemo(() => {
    if (!contextSnippet || contextSnippet.messages.length === 0) return '';
    return contextSnippet.messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'me' : 'companion'}: ${m.content}`)
      .join('\n');
  }, [contextSnippet]);

  /* Soft pulse on the loading placeholder cards */
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

  /* Generate (or regenerate) drafts from Bedrock. Debounced via the
   * timeout so a fast typer doesn't spam the API while updating the
   * recipient name. Falls back to the static templates if the call
   * fails or returns nothing. */
  useEffect(() => {
    let cancelled = false;
    /* Short debounce so name changes feel near-realtime. We also no
     * longer block re-renders behind the AI call: while regenerating,
     * existing drafts stay visible and a new set replaces them as soon
     * as Bedrock returns. */
    const timer = setTimeout(async () => {
      console.log('[TellSomeone] generating drafts · nameLen=' + name.trim().length + ' ctxLen=' + conversationContext.length);
      setGenerating(true);
      const drafts = await generateMessageDrafts({
        intent: 'tell-someone',
        tone: 'vulnerable',
        recipient: name.trim(),
        context: conversationContext,
        count: 3,
      });
      if (cancelled) return;
      if (drafts.length > 0) {
        setAiDrafts(drafts);
        /* Fresh drafts → drop any in-flight tweaks; the user expects
         * personalised text, not their stale edits on an old draft. */
        setEditedText({});
        setEditingIdx(null);
      } else {
        console.warn('[TellSomeone] AI drafts empty — falling back to templates');
        setAiDrafts(null);
      }
      setGenerating(false);
    }, 280);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [name, conversationContext]);

  /* Going back: mark the resume flag so /chat re-opens the crisis
   * page when ChatScreen focuses next. Same round-trip pattern the
   * box-breath side-flow uses. */
  const handleBack = useCallback(() => {
    crisisResumeStore.set();
    console.log('[TellSomeone] back → /chat (crisis will resume)');
    router.replace('/chat' as any);
  }, [router]);

  /* Share a specific draft. Accepts either an AI-generated string
   * (full message ready) OR a static-template Draft (legacy fallback). */
  const handleShareText = useCallback(async (message: string, idx: number) => {
    console.log('[TellSomeone] share idx=' + idx + ' len=' + message.length);
    try {
      const result = await Share.share({ message });
      /* Only record if the share was actually completed — dismissed
       * sheets shouldn't tell the AI the user reached out. */
      if (result.action === Share.sharedAction) {
        recordCrisisFlowEvent('sent-tell-someone-message');
      }
    } catch (err) {
      console.warn('[TellSomeone] share failed', err);
    }
  }, []);

  const handleToggleTweak = useCallback((idx: number, currentText: string) => {
    setEditingIdx((prev) => {
      const next = prev === idx ? null : idx;
      if (next === idx) {
        /* Seed the editor with the current draft text on open so the
         * user starts editing from where the AI left off. */
        setEditedText((m) => (m[idx] !== undefined ? m : { ...m, [idx]: currentText }));
      }
      return next;
    });
  }, []);

  const trimmedName = useMemo(() => name.trim(), [name]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Back to resources"
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Words for now</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>— some words, ready</Text>
            <Text style={styles.headline}>
              Words for when they{'’'}re{' '}
              <Text style={styles.headlineItalic}>hard to find</Text>.
            </Text>
            <Text style={styles.sub}>
              Tap one. Send it. Or change it first. No one needs to know what to say back.
            </Text>

            {/* Optional name input — ghost-styled so it doesn't feel
                like a required form field. Empty is fine. */}
            <View style={styles.nameField}>
              <Text style={styles.nameLabel}>THEIR NAME</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="optional — or how you’d start"
                placeholderTextColor="rgba(26,31,54,0.32)"
                returnKeyType="done"
                maxLength={40}
              />
            </View>

            {/* "here are three drafts" lives OUTSIDE the cards so the
             * label belongs to the section, not to draft #1. (When the
             * model leaks the same phrase into draft #1, cleanDraft
             * strips it server-side.) */}
            <Text style={styles.draftsHeading}>here are three drafts</Text>

            {/* Drafts — AI-generated when Bedrock returns, fall back
             * to static templates if the call failed. While generating,
             * pulse skeleton placeholders so the surface never feels
             * blank. */}
            <View style={styles.drafts}>
              {aiDrafts && aiDrafts.length > 0 ? (
                aiDrafts.map((message, i) => {
                  const isEditing = editingIdx === i;
                  const draftText = editedText[i] !== undefined ? editedText[i] : message;
                  return (
                    <View key={'ai-' + i} style={[styles.draftCard, { backgroundColor: SWATCHES[i % SWATCHES.length] }]}>
                      <Text style={styles.draftIndex}>0{i + 1} / 0{aiDrafts.length}</Text>
                      {isEditing ? (
                        <TextInput
                          style={[styles.draftText, styles.draftEditor]}
                          value={draftText}
                          onChangeText={(t) => setEditedText((m) => ({ ...m, [i]: t }))}
                          multiline
                          autoFocus
                          textAlignVertical="top"
                          placeholder="write it your way"
                          placeholderTextColor="rgba(26,31,54,0.32)"
                        />
                      ) : (
                        <Text style={styles.draftText}>{draftText}</Text>
                      )}
                      <View style={styles.draftActions}>
                        <TouchableOpacity
                          style={styles.shareBtn}
                          onPress={() => handleShareText(draftText, i)}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.shareBtnText}>Send this</Text>
                          <Glyphs.Arrow size={12} color={C.cream} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tweakBtn}
                          onPress={() => handleToggleTweak(i, draftText)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.tweakBtnText}>{isEditing ? 'Done' : 'Tweak'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : generating ? (
                /* Skeleton placeholders — three soft cards with a
                 * pulsing line so the user sees something is coming. */
                [0, 1, 2].map((i) => (
                  <Animated.View key={'skel-' + i} style={[styles.draftCard, { backgroundColor: SWATCHES[i] }, pulseStyle]}>
                    <View style={styles.skelLine} />
                    <View style={[styles.skelLine, { width: '85%', marginTop: 8 }]} />
                    <View style={[styles.skelLine, { width: '60%', marginTop: 8 }]} />
                  </Animated.View>
                ))
              ) : (
                /* Last-resort fallback: render the offline templates. */
                DRAFTS.map((d, i) => {
                  const isEditing = editingIdx === i;
                  const baseText = previewFor(d, trimmedName);
                  const draftText = editedText[i] !== undefined ? editedText[i] : baseText;
                  return (
                    <View key={d.id} style={[styles.draftCard, { backgroundColor: d.swatch }]}>
                      <Text style={styles.draftIndex}>0{i + 1} / 03</Text>
                      {isEditing ? (
                        <TextInput
                          style={[styles.draftText, styles.draftEditor]}
                          value={draftText}
                          onChangeText={(t) => setEditedText((m) => ({ ...m, [i]: t }))}
                          multiline
                          autoFocus
                          textAlignVertical="top"
                          placeholder="write it your way"
                          placeholderTextColor="rgba(26,31,54,0.32)"
                        />
                      ) : (
                        <Text style={styles.draftText}>{draftText}</Text>
                      )}
                      <View style={styles.draftActions}>
                        <TouchableOpacity
                          style={styles.shareBtn}
                          onPress={() => handleShareText(editedText[i] !== undefined ? draftText : fallbackBuild(d, trimmedName), i)}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.shareBtnText}>Send this</Text>
                          <Glyphs.Arrow size={12} color={C.cream} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tweakBtn}
                          onPress={() => handleToggleTweak(i, draftText)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.tweakBtnText}>{isEditing ? 'Done' : 'Tweak'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </FadingScrollWrapper>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 10,
  },
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

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  sub: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.15,
    color: C.ink2,
  },

  /* Name input — quiet, ghost-styled */
  nameField: {
    marginTop: 22,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nameLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: C.ink3,
  },
  nameInput: {
    marginTop: 4,
    fontFamily: 'Fraunces-Text',
    fontSize: 16,
    color: C.ink,
    letterSpacing: 0.15,
  },

  /* Draft cards */
  drafts: {
    marginTop: 18,
    gap: 12,
  },
  draftCard: {
    borderRadius: RADIUS.card,
    padding: 18,
  },
  draftIndex: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.ink2,
  },
  draftText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.1,
    color: C.ink,
  },
  draftActions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  shareBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.btn,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.cream,
    letterSpacing: 0.1,
  },
  tweakBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: RADIUS.btn,
    borderWidth: 1,
    borderColor: 'rgba(26,31,54,0.18)',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  tweakBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.ink,
    letterSpacing: 0.1,
  },
  draftEditor: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 80,
  },
  draftsHeading: {
    marginTop: 22,
    marginBottom: 10,
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 15,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  /* Loading skeleton lines — short cream-on-tone bars that pulse */
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(26,31,54,0.10)',
    width: '95%',
  },

});
