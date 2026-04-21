import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import MelloGradient from '@/components/common/MelloGradient';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { useAuth } from '@/contexts/AuthContext';

const { width: W, height: H } = Dimensions.get('window');

// ─── Decorative floating orb ─────────────────────────────────────────────────

function Orb({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }));
    scale.value   = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.12, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    position: 'absolute',
    left: x,
    top: y,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
  }));

  return <Animated.View style={style} />;
}

// ─── Sparkle SVG ─────────────────────────────────────────────────────────────

function Sparkle({ size = 28, color = '#8B7EF8' }: { size?: number; color?: string }) {
  const s = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path
        d="M14 2 L15.5 12 L24 14 L15.5 16 L14 26 L12.5 16 L4 14 L12.5 12 Z"
        fill={color}
      />
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeAboardScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();

  const [firstName, setFirstName] = useState('');

  // Animated values
  const iconAnim   = useSharedValue(0);
  const line1Anim  = useSharedValue(0);
  const nameAnim   = useSharedValue(0);
  const subAnim    = useSharedValue(0);
  const btnAnim    = useSharedValue(0);
  const iconBounce = useSharedValue(1);

  useEffect(() => {
    getOnboardingData().then((d) => {
      if (d.firstName) setFirstName(d.firstName);
    });

    const ease = Easing.out(Easing.cubic);
    iconAnim.value  = withDelay(100, withTiming(1, { duration: 500, easing: ease }));
    line1Anim.value = withDelay(320, withTiming(1, { duration: 550, easing: ease }));
    nameAnim.value  = withDelay(520, withTiming(1, { duration: 600, easing: ease }));
    subAnim.value   = withDelay(780, withTiming(1, { duration: 500, easing: ease }));
    btnAnim.value   = withDelay(1000, withTiming(1, { duration: 450, easing: ease }));

    // Gentle icon pulse after entrance
    iconBounce.value = withDelay(700, withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    ));
  }, []);

  const iconStyle  = useAnimatedStyle(() => ({
    opacity: iconAnim.value,
    transform: [{ scale: iconBounce.value * (0.4 + iconAnim.value * 0.6) }],
  }));
  const line1Style = useAnimatedStyle(() => ({
    opacity: line1Anim.value,
    transform: [{ translateY: (1 - line1Anim.value) * 20 }],
  }));
  const nameStyle  = useAnimatedStyle(() => ({
    opacity: nameAnim.value,
    transform: [{ translateY: (1 - nameAnim.value) * 20 }],
  }));
  const subStyle   = useAnimatedStyle(() => ({
    opacity: subAnim.value,
    transform: [{ translateY: (1 - subAnim.value) * 14 }],
  }));
  const btnStyle   = useAnimatedStyle(() => ({
    opacity: btnAnim.value,
    transform: [{ translateY: (1 - btnAnim.value) * 16 }],
  }));

  const handleContinue = () => {
    completeOnboarding();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MelloGradient />

 

 
    

      {/* Main content */}
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>

        <View style={styles.centerBlock}>

          

          {/* "Welcome to the family," */}
          <Animated.Text style={[styles.welcomeLine, line1Style]}>
            Welcome to{'\n'}the family,
          </Animated.Text>

          {/* Name */}
          <Animated.Text style={[styles.nameText, nameStyle]}>
            {firstName || 'friend'}.
          </Animated.Text>

          {/* Subtitle */}
          <Animated.Text style={[styles.subtitle, subStyle]}>
            You've taken the first step.{'\n'}We'll be right here with you.
          </Animated.Text>

        </View>

        <View style={{ flex: 1 }} />

        {/* Button */}
        <Animated.View style={btnStyle}>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={handleContinue}
          >
            <Text style={styles.btnText}>Let's go</Text>
          </Pressable>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F0FF',
  },
  sparkle: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  centerBlock: {
    alignItems: 'center',
    marginTop: H * 0.06,
    gap: 4,
  },
  iconWrap: {
    marginBottom: 28,
  },
  welcomeLine: {
    fontFamily: 'DMSerif',
    fontSize: 40,
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 50,
  },
  nameText: {
    fontFamily: 'DMSerif',
    fontSize: 52,
    color: '#8B7EF8',
    textAlign: 'center',
    lineHeight: 60,
    marginTop: 2,
  },
  subtitle: {
    marginTop: 20,
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: '#7A7A95',
    textAlign: 'center',
    lineHeight: 24,
  },
  btn: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  btnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 17,
    color: '#FFFFFF',
  },
});
