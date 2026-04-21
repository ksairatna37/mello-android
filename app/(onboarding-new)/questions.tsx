import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StatusBar, StyleSheet, Dimensions, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MelloGradient from '@/components/common/MelloGradient';
import { updateOnboardingData, saveCurrentStep, getOnboardingData } from '@/utils/onboardingStorage';
import type { OnboardingData } from '@/utils/onboardingStorage';
import { generateEmotionalProfile } from '@/services/chat/bedrockService';
import { saveEmotionalProfile } from '@/utils/emotionalProfileCache';
import { QuestionPage } from './_components/QuestionPage';
import { QUESTIONS } from './_components/types';
import type { Question } from './_components/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Answer maps (duplicated from emotional-mindwave to avoid cross-import) ───

const MOOD_WEATHER_MAP: Record<string, string> = {
  stormy: 'Stormy — everything feels like too much',
  rainy:  'Rainy — heavy and slow',
  foggy:  'Foggy — can\'t think straight',
  cloudy: 'Cloudy — up and down',
  okay:   'Surprisingly okay',
};
const SPIRIT_ANIMAL_MAP: Record<string, string> = {
  turtle:    'The Turtle — I go quiet and process alone',
  butterfly: 'The Butterfly — I need to talk it out',
  wolf:      'The Wolf — I need my people around me',
  lion:      'The Lion — just tell me what to do',
  shell:     'The Shell — I shut down first, then slowly open up',
};
const LATE_NIGHT_MAP: Record<string, string> = {
  loop:      'The Loop — same thoughts over and over',
  ache:      'The Ache — something hurts but I can\'t explain what',
  replay:    'The Replay — going over a conversation I can\'t undo',
  overwhelm: 'The Overwhelm — everything at once',
  void:      'The Void — nothing, just empty',
  wander:    'The Wander — I\'m fine, I just stumbled here',
};
const TEXT_TO_SELF_MAP: Record<string, string> = {
  okay:     '"Hey, you\'re going to be okay"',
  alone:    '"Stop carrying everything alone"',
  figured:  '"It\'s okay that you don\'t have it figured out"',
  grown:    '"You\'ve grown more than you know"',
  avoiding: '"The thing you\'re avoiding — it\'s time"',
};
const GROWTH_MAP: Record<string, string> = {
  '1': 'Seedling — just finding my footing',
  '2': 'Growing — making real progress',
  '3': 'Thriving — deeply grounded',
};
const WEAKEST_DIMENSION_MAP: Record<string, string> = {
  calm:       'Calm — my mind won\'t stop racing',
  clarity:    'Clarity — everything feels foggy and unclear',
  focus:      'Focus — I can\'t concentrate on what matters',
  confidence: 'Confidence — I keep second-guessing myself',
  positivity: 'Positivity — it\'s hard to find the bright side',
};
const SUPPORT_MAP: Record<string, string> = {
  listen:    'Just listen, no advice — I need to be heard first',
  understand:'Help me understand myself',
  tools:     'Give me practical tools to cope',
  checkin:   'Check in with me regularly',
  unsure:    'I\'m not sure yet — help me figure that out',
};

function buildAnswers(data: OnboardingData): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  if (data.moodWeather)
    out.push({ question: 'What\'s the weather inside your head right now?', answer: MOOD_WEATHER_MAP[data.moodWeather] ?? data.moodWeather });
  if (data.spiritAnimal)
    out.push({ question: 'When you\'re struggling, your coping style is most like...', answer: SPIRIT_ANIMAL_MAP[data.spiritAnimal] ?? data.spiritAnimal });
  if (data.lateNightMood)
    out.push({ question: 'It\'s 2am and you can\'t sleep. What\'s actually going on?', answer: LATE_NIGHT_MAP[data.lateNightMood] ?? data.lateNightMood });
  const textVal = TEXT_TO_SELF_MAP[data.textToSelf ?? ''] ?? data.textToSelf;
  if (textVal)
    out.push({ question: 'If you could text yourself from 6 months ago, you\'d say...', answer: textVal });
  if (data.emotionalBattery !== undefined)
    out.push({ question: 'How full is your emotional battery right now? (0 = empty, 100 = full)', answer: `${data.emotionalBattery}%` });
  if (data.weakestDimension)
    out.push({ question: 'Which emotional dimension feels hardest to hold on to lately?', answer: WEAKEST_DIMENSION_MAP[data.weakestDimension] ?? data.weakestDimension });
  if (data.emotionalGrowth)
    out.push({ question: 'Where are you in your emotional growth?', answer: GROWTH_MAP[data.emotionalGrowth] ?? data.emotionalGrowth });
  if (data.supportStyle)
    out.push({ question: 'What kind of support feels right for you?', answer: SUPPORT_MAP[data.supportStyle] ?? data.supportStyle });
  return out;
}

async function prefetchEmotionalProfile(): Promise<void> {
  try {
    const data    = await getOnboardingData();
    const answers = buildAnswers(data);
    if (answers.length === 0) return;
    const profile = await generateEmotionalProfile(answers);
    if (profile) await saveEmotionalProfile(profile);
  } catch {
    // fire-and-forget — never block the UI
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [settledIndex, setSettledIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});
  const [firstName, setFirstName] = useState('');
  const scrollLock = useRef(false);

  useEffect(() => {
    void saveCurrentStep('questions').catch(() => {});
    getOnboardingData().then((d) => { if (d.firstName) setFirstName(d.firstName); }).catch(() => {});
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (scrollLock.current) return;
    scrollLock.current = true;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setTimeout(() => {
      scrollLock.current = false;
      setSettledIndex(index);
    }, 400);
  }, []);

  const handleBack = useCallback((fromIndex: number) => {
    if (fromIndex > 0) {
      scrollToIndex(fromIndex - 1);
    } else {
      router.replace('/(onboarding-new)/name-input' as any);
    }
  }, [scrollToIndex, router]);

  const handleMultiToggle = useCallback((question: Question, optionId: string) => {
    setMultiAnswers((prev) => {
      const current = prev[question.id] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [question.id]: next };
    });
  }, []);

  const handleMultiContinue = useCallback(
    async (qIndex: number) => {
      if (scrollLock.current) return;
      const question = QUESTIONS[qIndex];
      const selected = multiAnswers[question.id] ?? [];
      if (!selected.length) return;

      if (question.storageKey) {
        void updateOnboardingData({ [question.storageKey]: selected } as Partial<OnboardingData>).catch(() => {});
      }

      scrollLock.current = true;
      const nextIndex = qIndex + 1;
      if (nextIndex < QUESTIONS.length) {
        scrollLock.current = false;
        scrollToIndex(nextIndex);
      } else {
        void prefetchEmotionalProfile();
        scrollLock.current = false;
        router.replace('/(onboarding-new)/analysing' as any);
      }
    },
    [multiAnswers, router, scrollToIndex]
  );

  const handleSelect = useCallback(
    async (question: Question, optionId: string, qIndex: number) => {
      if (scrollLock.current) return;
      scrollLock.current = true;
      setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
      if (question.storageKey) {
        void updateOnboardingData({ [question.storageKey]: optionId } as Partial<OnboardingData>).catch(() => {});
      }

      const nextIndex = qIndex + 1;
      setTimeout(async () => {
        if (nextIndex < QUESTIONS.length) {
          scrollLock.current = false;
          scrollToIndex(nextIndex);
        } else {
          // Last question answered — fire Bedrock in background while
          // the analysing animation plays (~5 s). Result will be cached
          // and ready before the user taps "See Result".
          void prefetchEmotionalProfile();
          scrollLock.current = false;
          router.replace('/(onboarding-new)/analysing' as any);
        }
      }, 680);
    },
    [router, scrollToIndex]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <MelloGradient />

      <FlatList
        ref={flatListRef}
        data={QUESTIONS}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item: question, index: qIndex }) => {
          const questionNumber = question.type === 'fact'
            ? null
            : QUESTIONS.slice(0, qIndex + 1).filter(q => q.type !== 'fact').length;
          return (
            <QuestionPage
              key={question.id}
              question={question}
              qIndex={qIndex}
              questionNumber={questionNumber}
              settledIndex={settledIndex}
              answer={answers[question.id]}
              multiAnswer={multiAnswers[question.id]}
              firstName={firstName}
              topInset={insets.top}
              bottomInset={insets.bottom}
              onSelect={handleSelect}
              onMultiToggle={handleMultiToggle}
              onMultiContinue={handleMultiContinue}
              onBack={handleBack}
            />
          );
        }}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },
});
