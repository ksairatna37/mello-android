/**
 * Emotional Mindwave Screen
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  useDerivedValue,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon, G } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';

import MelloGradient from '@/components/common/MelloGradient';
import { getOnboardingData, saveCurrentStep } from '@/utils/onboardingStorage';
import { generateEmotionalProfile } from '@/services/chat/bedrockService';
import {
  getEmotionalProfile,
  saveEmotionalProfile,
} from '@/utils/emotionalProfileCache';
import type { OnboardingData } from '@/utils/onboardingStorage';
import type { EmotionalProfile } from '@/services/chat/bedrockService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = Math.min(SCREEN_WIDTH - 80, 300);
const CENTER = CHART_SIZE / 2;
const RADIUS = CHART_SIZE / 2 - 38;

// ─── Answer Builder ───────────────────────────────────────────────────────────

const MOOD_WEATHER_MAP: Record<string, string> = {
  stormy: 'Stormy — everything feels like too much',
  rainy: 'Rainy — heavy and slow',
  foggy: "Foggy — can't think straight",
  cloudy: 'Cloudy — up and down',
  okay: 'Surprisingly okay',
};

const SPIRIT_ANIMAL_MAP: Record<string, string> = {
  turtle: 'The Turtle — I go quiet and process alone',
  butterfly: 'The Butterfly — I need to talk it out',
  wolf: 'The Wolf — I need my people around me',
  lion: 'The Lion — just tell me what to do',
  shell: 'The Shell — I shut down first, then slowly open up',
};

const LATE_NIGHT_MAP: Record<string, string> = {
  loop: 'The Loop — same thoughts over and over',
  ache: "The Ache — something hurts but I can't explain what",
  replay: "The Replay — going over a conversation I can't undo",
  overwhelm: 'The Overwhelm — everything at once',
  void: 'The Void — nothing, just empty',
  wander: "The Wander — I'm fine, I just stumbled here",
};

const TEXT_TO_SELF_MAP: Record<string, string> = {
  okay: '"Hey, you\'re going to be okay"',
  alone: '"Stop carrying everything alone"',
  figured: '"It\'s okay that you don\'t have it figured out"',
  grown: '"You\'ve grown more than you know"',
  avoiding: '"The thing you\'re avoiding — it\'s time"',
};

const MATURITY_MAP: Record<string, string> = {
  responsibility: 'Taking responsibility for my actions',
  self_reflection: 'Frequently doing emotional work and self-reflecting',
  conflict_resolution: 'Resolving conflicts instead of ignoring them',
  accepting_reality: 'Accepting reality, not denying it',
  learning_from_mistakes: 'Learning from past mistakes',
  emotion_regulation: 'Regulating emotions rather than acting on them',
  empathy: "Empathy and care for others' wellbeing",
};

const WEAKEST_DIMENSION_MAP: Record<string, string> = {
  calm:       'Calm — my mind won\'t stop racing',
  clarity:    'Clarity — everything feels foggy and unclear',
  focus:      'Focus — I can\'t concentrate on what matters',
  confidence: 'Confidence — I keep second-guessing myself',
  positivity: 'Positivity — it\'s hard to find the bright side',
};
const SUPPORT_MAP: Record<string, string> = {
  listen: 'Just listen, no advice — I need to be heard first',
  understand: 'Help me understand myself',
  tools: 'Give me practical tools to cope',
  checkin: 'Check in with me regularly',
  unsure: "I'm not sure yet — help me figure that out",
};

function buildAnswers(
  data: OnboardingData
): Array<{ question: string; answer: string }> {
  const answers: Array<{ question: string; answer: string }> = [];

  if (data.moodWeather) {
    answers.push({
      question: "What's the weather inside your head right now?",
      answer: MOOD_WEATHER_MAP[data.moodWeather] ?? data.moodWeather,
    });
  }

  if (data.spiritAnimal) {
    answers.push({
      question: "When you're struggling, your coping style is most like...",
      answer: SPIRIT_ANIMAL_MAP[data.spiritAnimal] ?? data.spiritAnimal,
    });
  }

  if (data.lateNightMood) {
    answers.push({
      question: "It's 2am and you can't sleep. What's actually going on?",
      answer: LATE_NIGHT_MAP[data.lateNightMood] ?? data.lateNightMood,
    });
  }

  const textToSelfValue = TEXT_TO_SELF_MAP[data.textToSelf ?? ''] ?? data.textToSelf;

  if (textToSelfValue) {
    answers.push({
      question: "If you could text yourself from 6 months ago, you'd say...",
      answer: textToSelfValue,
    });
  }

  if (data.emotionalBattery !== undefined) {
    answers.push({
      question:
        'How full is your emotional battery right now? (0 = empty, 100 = full)',
      answer: `${data.emotionalBattery}%`,
    });
  }

  if (data.weakestDimension) {
    answers.push({
      question: 'Which emotional dimension feels hardest to hold on to lately?',
      answer: WEAKEST_DIMENSION_MAP[data.weakestDimension] ?? data.weakestDimension,
    });
  }

  if (data.emotionalMaturity) {
    answers.push({
      question: 'Which best describes your emotional maturity right now?',
      answer: MATURITY_MAP[data.emotionalMaturity] ?? data.emotionalMaturity,
    });
  }

  if (data.supportStyle) {
    answers.push({
      question: 'What kind of support feels right for you?',
      answer: SUPPORT_MAP[data.supportStyle] ?? data.supportStyle,
    });
  }

  return answers;
}

// ─── Dimension Config ─────────────────────────────────────────────────────────

const DIMENSIONS = ['Calm', 'Clarity', 'Focus', 'Confidence', 'Positivity'] as const;
type DimensionKey = 'calm' | 'clarity' | 'focus' | 'confidence' | 'positivity';

interface Dimension {
  key: string;
  label: string;
  value: number; // 0-1
  angle: number;
}

function profileToDimensions(profile: EmotionalProfile): Dimension[] {
  const keys: DimensionKey[] = ['calm', 'clarity', 'focus', 'confidence', 'positivity'];
  const numDims = keys.length;
  const angleStep = (2 * Math.PI) / numDims;
  const startAngle = -Math.PI / 2;

  return keys.map((key, i) => ({
    key,
    label: DIMENSIONS[i],
    value: Math.max(0, Math.min(1, profile[key] / 100)),
    angle: startAngle + i * angleStep,
  }));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EmotionalMindwaveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<EmotionalProfile | null>(null);
  const [interpretation, setInterpretation] = useState('');

  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(18);
  const chartOpacity = useSharedValue(0);
  const chartScale = useSharedValue(0.82);
  const polygonProgress = useSharedValue(0);
  const dotsScale = useSharedValue(0);
  const interpOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(24);

  useEffect(() => {
    saveCurrentStep('emotional-mindwave');
    titleOpacity.value = withTiming(1, { duration: 600 });
    titleY.value = withTiming(0, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    loadProfile();
  }, []);

  const loadProfile = async () => {
    let result = await getEmotionalProfile();

    if (!result) {
      const data = await getOnboardingData();
      const answers = buildAnswers(data);
      result = await generateEmotionalProfile(answers);
      if (result) await saveEmotionalProfile(result);
    }

    if (!result) {
      const data = await getOnboardingData();
      result = {
        calm: 60,
        clarity: parseInt(data.emotionalBattery ?? '55', 10),
        focus: 55,
        confidence: 40,
        positivity: 55,
        interpretation:
          "Your emotional landscape is unique. Every answer shapes the person you're becoming.",
      };
    }

    setProfile(result);
    setInterpretation(result.interpretation);

    chartOpacity.value = withTiming(1, { duration: 600 });
    chartScale.value = withTiming(1, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });
    polygonProgress.value = withDelay(
      300,
      withTiming(1, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      })
    );
    dotsScale.value = withDelay(
      700,
      withTiming(1, {
        duration: 400,
        easing: Easing.inOut(Easing.ease),
      })
    );
    interpOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));
    buttonOpacity.value = withDelay(
      1200,
      withTiming(1, {
        duration: 500,
        easing: Easing.inOut(Easing.ease),
      })
    );
    buttonY.value = withDelay(
      1200,
      withTiming(0, {
        duration: 500,
        easing: Easing.inOut(Easing.ease),
      })
    );
  };

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const chartContainerStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
    transform: [{ scale: chartScale.value }],
  }));

  const interpStyle = useAnimatedStyle(() => ({
    opacity: interpOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonY.value }],
  }));

  const dimensions = useMemo(
    () => (profile ? profileToDimensions(profile) : []),
    [profile]
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <MelloGradient />

      {/* Title */}
      <Animated.View
        style={[
          styles.titleContainer,
          { paddingTop: insets.top + 25 },
          titleStyle,
        ]}
      >
        <Text style={styles.title}>Your Emotional Profile</Text>
      </Animated.View>

      {/* Radar Chart */}
      {profile && (
        <Animated.View style={[styles.chartContainer, chartContainerStyle]}>
          <RadarChart
            dimensions={dimensions}
            polygonProgress={polygonProgress}
            dotsScale={dotsScale}
          />
        </Animated.View>
      )}

      {/* Interpretation */}
      <Animated.View style={[styles.interpContainer, interpStyle]}>
        {(() => {
          const top = dimensions.length > 0
            ? dimensions.reduce((a, b) => (a.value > b.value ? a : b))
            : null;
          const pct = top ? Math.round(top.value * 100) : 0;
          return (
            <View style={styles.interpCard}>
              <View style={styles.interpCardLeft}>
                <View style={styles.interpCardLabelRow}>
                  <Text style={styles.interpCardSuperLabel}>Your Vibe</Text>
                  <View style={styles.interpCardBadge}>
                    <Text style={styles.interpCardBadgeText}>{top?.label}</Text>
                  </View>
                </View>
                <Text style={styles.interpCardScore}>{pct}</Text>
              </View>
              <View style={styles.interpCardRight}>
                <Text style={styles.interpretation}>{interpretation}</Text>
              </View>
            </View>
          );
        })()}
      </Animated.View>

      {/* Continue Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + 24 },
          buttonStyle,
        ]}
      >
        <Pressable
          onPress={() => {
            router.replace('/(onboarding-new)/share-result' as any);
          }}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────

interface RadarChartProps {
  dimensions: Dimension[];
  polygonProgress: SharedValue<number>;
  dotsScale: SharedValue<number>;
}

function RadarChart({ dimensions, polygonProgress, dotsScale }: RadarChartProps) {
  const [points, setPoints] = useState('');

  // Mark the function body as a worklet, and do ALL math inline here
  useDerivedValue(() => {
    'worklet';
    if (dimensions.length < 3) {
      runOnJS(setPoints)('');
      return;
    }

    const progress = polygonProgress.value;

    const pts = dimensions
      .map((d) => {
        const r = RADIUS * d.value * progress;
        const x = CENTER + Math.cos(d.angle) * r;
        const y = CENTER + Math.sin(d.angle) * r;
        return `${x},${y}`;
      })
      .join(' ');

    runOnJS(setPoints)(pts);
  }, [dimensions]);

  if (!dimensions || dimensions.length < 3) return null;

  const getPoint = (angle: number, r: number) => ({
    x: CENTER + Math.cos(angle) * r,
    y: CENTER + Math.sin(angle) * r,
  });

  const gridLevels = [0.33, 0.66, 1];
  const axisEndpoints = dimensions.map((d) => getPoint(d.angle, RADIUS));

  // Per-label nudge: [extraRadiusOffset, dxOffset, dyOffset]
  // Tune these to move each label independently.
  const LABEL_TWEAKS: Record<string, [number, number, number]> = {
    Calm:       [0,   0,  20],   // top
    Clarity:    [0,  -0,   10],   // top-right
    Focus:      [0,   -10,   0],   // bottom-right
    Confidence: [0,  -0,   -2],   // bottom-left
    Positivity: [0, -0,   10],   // top-left
  };

  const maxDimValue = Math.max(...dimensions.map((d) => d.value));

  const labelPositions = dimensions.map((d) => {
    const [extraR, dx, dy] = LABEL_TWEAKS[d.label] ?? [0, 0, 0];
    const nudge = RADIUS + 42 + extraR;
    const pos = getPoint(d.angle, nudge);

    const alignSelf: 'flex-start' | 'center' | 'flex-end' =
      pos.x < CENTER - 20
        ? 'flex-end'
        : pos.x > CENTER + 20
        ? 'flex-start'
        : 'center';

    return {
      x: pos.x + dx,
      y: pos.y + dy,
      label: d.label,
      value: Math.round(d.value * 100),
      alignSelf,
      isHighest: d.value === maxDimValue,
    };
  });

  return (
    <View style={{ width: CHART_SIZE, height: CHART_SIZE }}>
      <Svg width={CHART_SIZE} height={CHART_SIZE}>
        {/* Grid */}
        {gridLevels.map((lvl, i) => (
          <Circle
            key={i}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS * lvl}
            fill="none"
            stroke="rgba(139,126,248,0.22)"
            strokeWidth={1}
            strokeDasharray="4,5"
          />
        ))}

        {/* Axis */}
        {axisEndpoints.map((pt, i) => (
          <Line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={pt.x}
            y2={pt.y}
            stroke="rgba(139,126,248,0.30)"
            strokeWidth={1}
            strokeDasharray="4,5"
          />
        ))}

        {/* Filled Polygon */}
        {points !== '' && (
          <Polygon
            points={points}
            fill="rgba(139,126,248,0.35)"
            stroke="#8B7EF8"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}

        {/* Glow + Dots */}
        {dimensions.map((d, i) => {
          const maxVal = Math.max(...dimensions.map((x) => x.value));
          return (
            <GlowDot
              key={`dot-${i}`}
              dimension={d}
              polygonProgress={polygonProgress}
              dotsScale={dotsScale}
              isHighest={d.value === maxVal}
            />
          );
        })}

      </Svg>

      {/* Labels */}
      {labelPositions.map((lp, i) => (
        <View
          key={i}
          style={[styles.labelWrap, { left: lp.x - 52, top: lp.y - 22 }]}
          pointerEvents="none"
        >
          <Text style={[styles.labelPct, { textAlign: 'center' }]}>
            {lp.value}%
          </Text>

          <Text style={[styles.labelName, { textAlign: 'center' }]}>
            {lp.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Glow Dot ─────────────────────────────────────────────────────────────────

interface GlowDotProps {
  dimension: Dimension;
  polygonProgress: SharedValue<number>;
  dotsScale: SharedValue<number>;
  isHighest: boolean;
}

function GlowDot({ dimension, polygonProgress, dotsScale, isHighest }: GlowDotProps) {
  const [glow, setGlow] = useState({ cx: CENTER, cy: CENTER, r: 0 });
  const [dot, setDot] = useState({ cx: CENTER, cy: CENTER, r: 0 });
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isHighest) return;
    pulse.value = withRepeat(
      withTiming(1.55, {
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [isHighest]);

  useDerivedValue(() => {
    'worklet';
    const prog = polygonProgress.value;
    const r = RADIUS * dimension.value * prog;
    const cx = CENTER + Math.cos(dimension.angle) * r;
    const cy = CENTER + Math.sin(dimension.angle) * r;

    const pulseScale = pulse.value; // always read so worklet tracks pulse as dependency
    const glowR = 13 * dotsScale.value * (isHighest ? pulseScale : 1);
    const dotR = 7 * dotsScale.value;

    runOnJS(setGlow)({ cx, cy, r: glowR });
    runOnJS(setDot)({ cx, cy, r: dotR });
  });

  return (
    <G>
      <Circle
        cx={glow.cx}
        cy={glow.cy}
        r={glow.r}
        fill="rgba(139,126,248,0.28)"
      />
      <Circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="#A78BFA" />
    </G>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },

  titleContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'DMSerif',
    fontSize: 32,
    color: '#1A1A1A',
    lineHeight: 42,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#8888A0',
    textAlign: 'center',
  },

  chartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  labelWrap: {
    position: 'absolute',
    width: 104,
  },
  labelName: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: '#3A3A52',
  },
  labelPct: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#8B7EF8',
    marginTop: 1,
  },

  interpContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  interpCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#8b7ef84d',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 25,
  },
  interpCardLeft: {},
  interpCardRight: {
    width: '100%',
  },
  interpCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  interpCardBadge: {
    backgroundColor: '#8B7EF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  interpCardBadgeText: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: '#fff',
  },
  interpCardSuperLabel: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#8B7EF8',
    letterSpacing: 0.3,
  },
  interpCardScore: {
    fontSize: 64,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    lineHeight: 68,
  },
  interpretation: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#6b6b6b',
    lineHeight: 20,
  },

  buttonContainer: {
    paddingHorizontal: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#fff',
    letterSpacing: 0.3,
  },
});