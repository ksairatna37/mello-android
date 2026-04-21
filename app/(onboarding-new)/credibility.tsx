import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_GAP = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.5;
const ICON_AREA_HEIGHT = CARD_HEIGHT * 0.7;
const AUTO_SCROLL_MS = 2600;

const CREDENTIALS = [
  {
    icon: 'brain-outline' as const,
    title: 'Cognitive Behavioral\nTherapy (CBT)',
    description: 'Built on the gold standard of evidence-based psychological treatment',
    colors: ['#2D1F8A', '#4A38C8'] as [string, string],
  },
  {
    icon: 'leaf-outline' as const,
    title: 'Mindfulness-Based\nResearch',
    description: 'Techniques validated by 30+ years of peer-reviewed clinical studies',
    colors: ['#5040C0', '#7B6EF0'] as [string, string],
  },
  {
    icon: 'globe-outline' as const,
    title: 'WHO Mental Health\nGuidelines',
    description: 'Aligned with global mental health care standards and best practices',
    colors: ['#7060D8', '#9B8EFF'] as [string, string],
  },
  {
    icon: 'people-outline' as const,
    title: 'Clinical Psychology\nAdvisory',
    description: 'Designed alongside licensed mental health professionals',
    colors: ['#3D2EA8', '#6452DC'] as [string, string],
  },
];

const LOOPED = [...CREDENTIALS, ...CREDENTIALS, ...CREDENTIALS];
const N = CREDENTIALS.length;

function CredCard({ item }: { item: typeof CREDENTIALS[0] }) {
  const outerHalo = ICON_AREA_HEIGHT * 0.62;
  const innerCircle = outerHalo * 0.66;
  const iconSize = innerCircle * 0.44;

  return (
    <View style={styles.cardOuter}>
      <LinearGradient
        colors={item.colors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.card}
      >
        {/* Icon area — 70% */}
        <View style={[styles.iconArea, { height: ICON_AREA_HEIGHT }]}>
          <View style={[styles.iconHaloOuter, { width: outerHalo, height: outerHalo, borderRadius: outerHalo / 2 }]}>
            <View style={[styles.iconHaloInner, { width: innerCircle, height: innerCircle, borderRadius: innerCircle / 2 }]}>
              <Ionicons name={item.icon} size={iconSize} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Text area — 30% */}
        <View style={styles.textArea}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function CredibilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const currentIndex = useRef(N);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intercept Android back — credibility is the stack root, back should go to welcome
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/(onboarding)/welcome' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const headerAnim = useSharedValue(0);
  const btnAnim = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    headerAnim.value = withDelay(80, withTiming(1, { duration: 600, easing: ease }));
    btnAnim.value = withDelay(500, withTiming(1, { duration: 450, easing: ease }));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      flatRef.current?.scrollToOffset({ offset: N * SNAP_INTERVAL, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const scrollTo = useCallback((index: number, animated = true) => {
    flatRef.current?.scrollToOffset({ offset: index * SNAP_INTERVAL, animated });
    currentIndex.current = index;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      scrollTo(currentIndex.current + 1, true);
    }, AUTO_SCROLL_MS);
  }, [scrollTo]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const handleScrollEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    currentIndex.current = idx;
    if (idx >= N * 2) {
      const eq = idx - N;
      flatRef.current?.scrollToOffset({ offset: eq * SNAP_INTERVAL, animated: false });
      currentIndex.current = eq;
    } else if (idx < N) {
      const eq = idx + N;
      flatRef.current?.scrollToOffset({ offset: eq * SNAP_INTERVAL, animated: false });
      currentIndex.current = eq;
    }
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 16 }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnAnim.value,
    transform: [{ translateY: (1 - btnAnim.value) * 10 }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#1A1030', '#2D1B69', '#3D2A8A']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>

        {/* Centered header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.eyebrow}>built on science</Text>
          <Text style={styles.heading}>Mello is grounded{'\n'}in real research</Text>
        </Animated.View>

        {/* Carousel */}
        <View style={styles.carouselWrapper}>
          <FlatList
            ref={flatRef}
            data={LOOPED}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
            getItemLayout={(_, index) => ({
              length: SNAP_INTERVAL,
              offset: SNAP_INTERVAL * index,
              index,
            })}
            onScrollBeginDrag={startTimer}
            onMomentumScrollEnd={handleScrollEnd}
            renderItem={({ item }) => <CredCard item={item} />}
          />
        </View>

        {/* Got it button — pinned to bottom like personalize-intro */}
        <Animated.View style={btnStyle}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/(onboarding-new)/personalize-intro' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1030',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontFamily: 'Outfit-Medium',
    fontSize: 11,
    color: '#A89BF8',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heading: {
    fontFamily: 'DMSerif',
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 42,
    textAlign: 'center',
  },
  carouselWrapper: {
    marginHorizontal: -24,
  },
  cardOuter: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHaloOuter: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHaloInner: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  cardTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  cardDescription: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
