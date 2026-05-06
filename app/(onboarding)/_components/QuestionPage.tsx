/**
 * QuestionPage — 1:1 port of MBOnboardQuestion in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-onboarding-q.jsx
 *
 * Tone-colored canvas (peach/lavender/sage/butter/coral per question),
 * top bar (back · ONBOARDING NN / 10 · SKIP), 10-seg progress bar, mono
 * kicker, Fraunces display title with italic emphasis, paper option
 * cards with a coral-dot radio.
 *
 * Interaction: tap an option → auto-scroll to the next question.
 * Special types: battery / leaf / freeform / fact (interstitial).
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
} from 'react-native';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import { BatterySlider } from './BatterySlider';
import { DidYouKnow } from './DidYouKnow';
import { LeafGrowth } from './LeafGrowth';
import type { Question, ToneKey, TitleSegment } from './types';
import { TOTAL_QUESTIONS } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TONE: Record<ToneKey, string> = {
  peach:    C.peach,
  lavender: C.lavender,
  sage:     C.sage,
  butter:   C.butter,
  coral:    C.coral,
};

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface QuestionPageProps {
  question: Question | { id: string; type: 'fact' };
  qIndex: number;
  questionNumber: number | null;
  answer?: string;
  firstName: string;
  topInset: number;
  bottomInset: number;

  /** Single-select tap → auto-advance. */
  onSelect: (question: Question, optionId: string, qIndex: number) => void;
  /** Interstitial continue / battery confirm / leaf confirm / freeform submit. */
  onCommit: (qIndex: number, value?: string | number) => void;
  onBack: (fromIndex: number) => void;
  onSkip: (fromIndex: number) => void;
}

/* ─── Component ─────────────────────────────────────────────────────── */

function QuestionPageImpl({
  question,
  qIndex,
  questionNumber,
  answer,
  firstName,
  topInset,
  bottomInset,
  onSelect,
  onCommit,
  onBack,
  onSkip,
}: QuestionPageProps) {
  // Interstitial — render dedicated DidYouKnow screen.
  if (question.type === 'fact') {
    return (
      <View style={[styles.page, { width: SCREEN_WIDTH }]}>
        <DidYouKnow
          firstName={firstName}
          topInset={topInset}
          bottomInset={bottomInset}
          onContinue={() => onCommit(qIndex)}
          onBack={() => onBack(qIndex)}
        />
      </View>
    );
  }

  const q = question as Question;
  const bg = TONE[q.tone];

  // Header (top bar + progress + intro copy) is shared. Body shape changes
  // with the question type so that flex-based children (LeafGrowth) get a
  // real bounded height, not a collapsing scroll container.
  const Header = (
    <>
      <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
        <TouchableOpacity onPress={() => onBack(qIndex)} style={styles.backBtn} activeOpacity={0.7}>
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.topLabel}>
          {String(questionNumber ?? qIndex + 1).padStart(2, '0')} / {String(TOTAL_QUESTIONS).padStart(2, '0')}
        </Text>
        <TouchableOpacity onPress={() => onSkip(qIndex)} activeOpacity={0.6} hitSlop={10}>
          <Text style={styles.skipLabel}>SKIP</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
          <View key={i} style={[styles.progressSeg, i < (questionNumber ?? 0) ? styles.progressOn : styles.progressOff]} />
        ))}
      </View>
    </>
  );

  // Kicker removed across all questions — title + subtitle is enough, the
  // kicker was redundant context and crowded the top.
  const Intro = (
    <View style={styles.introBlock}>
      <Text style={styles.title}>{renderTitle(q.title)}</Text>
      <Text style={styles.subtitle}>{q.subtitle}</Text>
    </View>
  );

  // Leaf + battery render outside the ScrollView so their flex-1 layouts
  // have a concrete parent height. Everything else scrolls as before.
  if (q.type === 'leaf') {
    return (
      <View style={[styles.page, { width: SCREEN_WIDTH, backgroundColor: bg }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        {Header}
        {Intro}
        {/* Keep the leaf mounted unconditionally. Previously it was gated on
            isActive, which caused a ~1s remount delay when navigating back
            from Q10. The FlatList already virtualizes so extra cost is low. */}
        <View style={[styles.flexBody, { paddingBottom: bottomInset + 16 }]}>
          <LeafGrowth onConfirm={(level) => onCommit(qIndex, String(level))} />
        </View>
      </View>
    );
  }

  if (q.type === 'freeform') {
    return (
      <View style={[styles.page, { width: SCREEN_WIDTH, backgroundColor: bg }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        {Header}
        <FreeformLayout
          intro={Intro}
          placeholder={q.placeholder ?? ''}
          initial={answer ?? ''}
          bottomInset={bottomInset}
          bg={bg}
          onSubmit={(v) => onCommit(qIndex, v)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.page, { width: SCREEN_WIDTH, backgroundColor: bg }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {Header}

      <FadingScrollWrapper bg={bg} topFadeHeight={20} bottomFadeHeight={24}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {Intro}

          <View style={styles.bodyBlock}>

          {/* Body */}
          {q.type === 'options' && (
            <View style={styles.optionsList}>
              {q.options!.map((o) => {
                const sel = answer === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => onSelect(q, o.id, qIndex)}
                    activeOpacity={0.85}
                    style={[styles.optionCard, sel && styles.optionCardOn]}
                  >
                    <View style={[styles.radio, sel && styles.radioOn]}>
                      {sel && <Glyphs.Check size={12} color={C.ink} />}
                    </View>
                    <Text style={styles.optionIcon}>{o.icon}</Text>
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionLabel, sel && styles.optionLabelOn]}>{o.t}</Text>
                      {o.sub ? (
                        <Text style={[styles.optionSub, sel && styles.optionSubOn]}>{o.sub}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {q.type === 'battery' && (
            <View style={styles.specialWrap}>
              <BatterySlider
                initialPct={typeof answer === 'string' ? parseInt(answer, 10) || 50 : 50}
                onConfirm={(pct) => onCommit(qIndex, pct)}
              />
            </View>
          )}

          </View>
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

// React.memo so a parent re-render (e.g. setAnswers in QuestionsScreen)
// doesn't re-render every page in the FlatList. Each page only re-renders
// when its own props change — most importantly, only the page whose
// `answer` actually changed.
export const QuestionPage = React.memo(QuestionPageImpl);

/* ─── Title renderer ─────────────────────────────────────────────────── */

function renderTitle(parts: TitleSegment[]) {
  return parts.map((p, i) =>
    typeof p === 'string' ? (
      <Text key={i} style={styles.titleUpright}>{p}</Text>
    ) : (
      <Text key={i} style={styles.titleItalic}>{p.i}</Text>
    ),
  );
}

/* ─── Freeform layout (Q10) ─────────────────────────────────────────── */

/**
 * Dedicated layout for Q10 so the Finish button can live in a pinned
 * footer (matches the "Five more, gently" pattern on DidYouKnow). Card
 * + counter are scrollable (for when keyboard opens), button is fixed.
 */
function FreeformLayout({
  intro,
  placeholder,
  initial,
  bottomInset,
  bg,
  onSubmit,
}: {
  intro: React.ReactNode;
  placeholder: string;
  initial: string;
  bottomInset: number;
  bg: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<TextInput>(null);

  return (
    <>
      <FadingScrollWrapper bg={bg} topFadeHeight={20} bottomFadeHeight={20}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {intro}

          <View style={styles.bodyBlock}>
            <View style={{ marginTop: 24 }}>
              <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.freeCard}>
                <Text style={styles.freeLabel}>YOUR WORDS</Text>
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={setValue}
                  placeholder={placeholder}
                  placeholderTextColor="rgba(26,31,54,0.4)"
                  multiline
                  maxLength={240}
                  style={styles.freeInput}
                  textAlignVertical="top"
                />
              </TouchableOpacity>
              <Text style={styles.freeCount}>{value.length} / 240</Text>
            </View>
          </View>
        </ScrollView>
      </FadingScrollWrapper>

      {/* Footer — Finish button pinned at the bottom */}
      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        <TouchableOpacity onPress={() => onSubmit(value.trim())} style={styles.finishBtn} activeOpacity={0.85}>
          <Text style={styles.finishText}>Finish</Text>
          <Glyphs.Arrow size={13} color={C.cream} />
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  page: { flex: 1 },

  /* Top bar */
  topBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  topLabel:  { fontFamily: 'JetBrainsMono-Medium', fontSize: 10, letterSpacing: 2.2, color: C.ink },
  skipLabel: { fontFamily: 'JetBrainsMono',         fontSize: 10, letterSpacing: 2.2, color: C.ink3 },

  /* Progress */
  progressRow: { paddingHorizontal: 20, marginTop: 2, flexDirection: 'row', gap: 3 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  progressOn:  { backgroundColor: C.ink },
  progressOff: { backgroundColor: 'rgba(26,31,54,0.15)' },

  /* Scroll — no horizontal padding here; the Intro block + content list
     provide their own so we don't accidentally double-pad against the
     flex-based (leaf) layout below. */
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },

  /* Intro block — canonical left/right padding for every question type */
  introBlock: { paddingHorizontal: 20, paddingTop: 26 },

  /* Body block — same horizontal padding as the intro so option cards,
     battery, freeform, etc. sit at identical insets across every type */
  bodyBlock: { paddingHorizontal: 20 },

  /* Flex body — used when body needs a real height (leaf) */
  flexBody: { flex: 1 },

  /* Intro */
  kicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11, letterSpacing: 2.2,
    color: C.ink3, textTransform: 'uppercase',
  },
  title: { marginTop: 14 },
  titleUpright: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 42,
    color: C.ink,
  },
  titleItalic: {
    fontFamily: 'Fraunces-MediumItalic',
    fontSize: 32,
    lineHeight: 42,
    color: C.ink,
  },
  subtitle: {
    fontFamily: 'Fraunces-Text',
    fontSize: 14, lineHeight: 21, color: C.ink2,
    marginTop: 12, maxWidth: 320, letterSpacing: 0.2,
  },

  /* Options */
  optionsList: { marginTop: 22, gap: 8 },
  optionCard: {
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line2,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  optionCardOn: { backgroundColor: C.ink, borderColor: 'transparent' },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { backgroundColor: C.coral, borderColor: 'transparent' },
  optionIcon: {
    width: 28,
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    fontFamily: 'System',
  },
  optionTextWrap: { flex: 1, minWidth: 0 },
  optionLabel:    { fontFamily: 'Fraunces-Medium',         fontSize: 15, lineHeight: 20, color: C.ink,  letterSpacing: 0.2 },
  optionLabelOn:  { color: C.cream },
  optionSub:      { fontFamily: 'Fraunces-Text-Italic',    fontSize: 12, color: C.ink3, marginTop: 3, letterSpacing: 0.15 },
  optionSubOn:    { color: 'rgba(251,245,238,0.7)' },

  /* Special types */
  specialWrap: { marginTop: 20, alignItems: 'center' },

  /* Freeform */
  freeCard:  { backgroundColor: C.paper, borderRadius: 20, padding: 18, minHeight: 180 },
  freeLabel: { fontFamily: 'JetBrainsMono', fontSize: 10, letterSpacing: 2, color: C.ink3, textTransform: 'uppercase' },
  freeInput: {
    marginTop: 12,
    fontFamily: 'Fraunces-Italic',
    fontSize: 17, lineHeight: 24, color: C.ink,
    letterSpacing: 0.2, padding: 0, minHeight: 120,
  },
  freeCount: { marginTop: 10, textAlign: 'right', fontFamily: 'JetBrainsMono', fontSize: 10, letterSpacing: 1.6, color: C.ink3 },

  /* Footer — pinned bottom (used only by Q10 freeform for the Finish button) */
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  finishBtn: {
    backgroundColor: C.ink,
    paddingVertical: 16, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  finishText: { fontFamily: 'Inter-Medium', fontSize: 15, color: C.cream, letterSpacing: 0.2 },
});
