/**
 * Onboarding questions container — Claude Design 10-question flow.
 *
 * Horizontal paginated FlatList (one question per page). Single-select
 * taps auto-scroll to the next page (no Continue button). Battery /
 * leaf / freeform / interstitial commit through `onCommit`. Skip uses
 * the same commit-with-undefined path so skipped answers stay empty.
 *
 * When the last question (Q10) commits, we kick off the Bedrock
 * emotional-profile generation in the background and route to the
 * analysing screen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StatusBar, StyleSheet, BackHandler } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  updateOnboardingData,
  getOnboardingData,
} from '@/utils/onboardingStorage';
import type { OnboardingData } from '@/utils/onboardingStorage';
import { generateEmotionalProfile, buildEmotionalAnswers } from '@/services/chat/bedrockService';
import { saveEmotionalProfile } from '@/utils/emotionalProfileCache';
import { BRAND } from '@/components/common/BrandGlyphs';
import { QuestionPage } from './_components/QuestionPage';
import { QUESTIONS } from './_components/types';
import type { Question } from './_components/types';

async function prefetchEmotionalProfile(): Promise<void> {
  try {
    const data = await getOnboardingData();
    const answers = buildEmotionalAnswers(data as Record<string, unknown>);
    if (answers.length === 0) return;
    const profile = await generateEmotionalProfile(answers);
    if (profile) await saveEmotionalProfile(profile);
  } catch {
    // fire-and-forget — never block the UI
  }
}

/* ─── Screen ─────────────────────────────────────────────────────────── */

export default function QuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // PagerView wraps Android ViewPager2 / iOS UIPageViewController. The
  // page transition runs entirely native — same mechanism as react-
  // native-screens' stack push (welcome → credibility smoothness),
  // applied to in-screen paging.
  const pagerRef   = useRef<PagerView>(null);
  const pageIndex  = useRef(0);
  const scrollLock = useRef(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    // Load only firstName for the DidYouKnow greeting. Intentionally do NOT
    // restore previously-answered questions — user wants each session to
    // start fresh so they don't see stale pre-selected options.
    getOnboardingData()
      .then((d) => { if (d.firstName) setFirstName(d.firstName); })
      .catch(() => {});
  }, []);

  // PagerView's `setPage(index)` runs the slide animation on the native
  // pager. Native-driven, no bridge crossings during the transition.
  // The lock is released by `onPageSelected` once the pager settles.
  const scrollToIndex = useCallback((index: number) => {
    if (scrollLock.current) return;
    scrollLock.current = true;
    pageIndex.current = index;
    pagerRef.current?.setPage(index);
  }, []);

  const advance = useCallback(
    (fromIndex: number) => {
      const nextIndex = fromIndex + 1;
      if (nextIndex < QUESTIONS.length) {
        scrollToIndex(nextIndex);
      } else {
        void prefetchEmotionalProfile();
        // Push (not replace) so the forward transition animates as a
        // forward slide. Analysing blocks hardware back, so leaving
        // /questions on the stack underneath is safe — user can't pop
        // back to it accidentally.
        router.push('/(onboarding)/analysing' as any);
      }
    },
    [router, scrollToIndex],
  );

  const handleBack = useCallback(
    (fromIndex: number) => {
      if (fromIndex > 0) {
        // Inside the pager: scroll to the previous question.
        scrollToIndex(fromIndex - 1);
        return;
      }
      // Q1 back: ALWAYS router.replace to /name-input. Never
      // router.back() — when the user lands here via RouterGate's
      // resume logic on app reopen (the stack underneath is /, not
      // /name-input), router.back() pops to /, and RouterGate
      // immediately re-routes them back to /questions. Net effect:
      // "back" appears to redirect to the same screen. Replace
      // explicitly forces the right destination regardless of how
      // they got here.
      router.replace('/(onboarding)/name-input' as any);
    },
    [router, scrollToIndex],
  );

  // Hardware back inside the pager: route to the previous question
  // instead of popping the whole stack. Without this, Android back
  // accidentally exits the entire questions flow on Q1, and on
  // Q2-Q10 it exits to name-input — both lose progress.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        // Block during a paging animation so a fast double-press
        // can't desync the lock.
        if (scrollLock.current) return true;
        handleBack(pageIndex.current);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [handleBack]),
  );

  const persist = useCallback((q: Question, value: string | number) => {
    if (!q.storageKey) return;
    void updateOnboardingData({ [q.storageKey]: value } as Partial<OnboardingData>).catch(() => {});
  }, []);

  const handleSelect = useCallback(
    (q: Question, optionId: string, qIndex: number) => {
      if (scrollLock.current) return;
      setAnswers((prev) => ({ ...prev, [q.id]: optionId }));
      persist(q, optionId);

      // Pause so the selected state is visible before we scroll.
      setTimeout(() => advance(qIndex), 700);
    },
    [advance, persist],
  );

  const handleCommit = useCallback(
    (qIndex: number, value?: string | number) => {
      if (scrollLock.current) return;
      const item = QUESTIONS[qIndex];
      if (item.type !== 'fact') {
        const q = item as Question;
        if (value !== undefined && value !== '') {
          setAnswers((prev) => ({ ...prev, [q.id]: String(value) }));
          persist(q, value);
        }
      }
      // Per-type delay so internal commit animations finish before the
      // pager slides away. Battery has a terminal-nub bloom; leaf has a
      // stage-chip slide. Fact (interstitial) and freeform are button
      // presses so a shorter pause matches the standard select feel.
      const delay =
        item.type === 'battery'  ? 1100 :
        item.type === 'leaf'     ? 850  :
        item.type === 'freeform' ? 200  :
        item.type === 'fact'     ? 200  :
        700;
      setTimeout(() => advance(qIndex), delay);
    },
    [advance, persist],
  );

  const handleSkip = useCallback(
    (qIndex: number) => {
      if (scrollLock.current) return;
      advance(qIndex);
    },
    [advance],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        // User cannot swipe — only programmatic advance via setPage.
        scrollEnabled={false}
        // No overdraw between pages; the slide is the only animation.
        overdrag={false}
        onPageSelected={(e) => {
          pageIndex.current = e.nativeEvent.position;
          scrollLock.current = false;
        }}
      >
        {QUESTIONS.map((question, qIndex) => {
          const questionNumber =
            question.type === 'fact'
              ? null
              : QUESTIONS.slice(0, qIndex + 1).filter((q) => q.type !== 'fact').length;

          return (
            <View key={question.id} style={styles.page}>
              <QuestionPage
                question={question}
                qIndex={qIndex}
                questionNumber={questionNumber}
                answer={answers[question.id]}
                firstName={firstName}
                topInset={insets.top}
                bottomInset={insets.bottom}
                onSelect={handleSelect}
                onCommit={handleCommit}
                onBack={handleBack}
                onSkip={handleSkip}
              />
            </View>
          );
        })}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.cream },
  pager:     { flex: 1 },
  page:      { flex: 1 },
});
