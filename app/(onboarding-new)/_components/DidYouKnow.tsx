import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface DidYouKnowProps {
  firstName?: string;
  onContinue: () => void;
}

// Filled lightbulb with glow rays — mirrors the reference screenshot
function BulbIcon({ size = 64 }: { size?: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r  = s * 0.22;
  return (
    <Svg width={s} height={s} viewBox="0 0 64 64">
      {/* Rays */}
      <Line x1="32" y1="4"  x2="32" y2="10" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="32" y1="54" x2="32" y2="60" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="4"  y1="32" x2="10" y2="32" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="54" y1="32" x2="60" y2="32" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="10" y1="10" x2="15" y2="15" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="54" y1="10" x2="49" y2="15" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="10" y1="54" x2="15" y2="49" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      <Line x1="54" y1="54" x2="49" y2="49" stroke="#8B7EF8" strokeWidth="3" strokeLinecap="round" />
      {/* Bulb body — filled */}
      <Path
        d="M32 14 C22 14 15 21 15 30 C15 36 18 40 23 43 L23 47 C23 48.1 23.9 49 25 49 L39 49 C40.1 49 41 48.1 41 47 L41 43 C46 40 49 36 49 30 C49 21 42 14 32 14 Z"
        fill="#8B7EF8"
      />
      {/* Base bands */}
      <Path d="M26 49 L38 49 L37 52 L27 52 Z" fill="#7165E3" />
      <Path d="M27 52 L37 52 L36 55 L28 55 Z" fill="#5E54C8" />
      {/* Inner glow highlight */}
      <Circle cx="27" cy="26" r="4" fill="rgba(255,255,255,0.25)" />
    </Svg>
  );
}

export function DidYouKnow({ firstName, onContinue }: DidYouKnowProps) {
  const iconAnim  = useSharedValue(0);
  const titleAnim = useSharedValue(0);
  const cardAnim  = useSharedValue(0);
  const bodyAnim  = useSharedValue(0);
  const btnAnim   = useSharedValue(0);

  useEffect(() => {
    const cfg = { duration: 400, easing: Easing.out(Easing.cubic) };
    iconAnim.value  = withDelay(0,   withTiming(1, cfg));
    titleAnim.value = withDelay(100, withTiming(1, cfg));
    cardAnim.value  = withDelay(240, withTiming(1, cfg));
    bodyAnim.value  = withDelay(380, withTiming(1, cfg));
    btnAnim.value   = withDelay(520, withTiming(1, cfg));
  }, []);

  const a = (v: Animated.SharedValue<number>, dy = 14) =>
    useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * dy }] }));

  return (
    <View style={styles.outer}>

      <Animated.View style={a(iconAnim)}>
        <BulbIcon size={72} />
      </Animated.View>

      <Animated.Text style={[styles.heading, a(titleAnim)]}>
        {`DID YOU\nKNOW?`}
      </Animated.Text>

      <Animated.View style={[styles.statCard, a(cardAnim, 18)]}>
        <Text style={styles.statNumber}>3<Text style={styles.statX}>x</Text></Text>
        <View style={styles.statDivider} />
        <Text style={styles.statLabel}>faster recovery{'\n'}from stress & anxiety</Text>
      </Animated.View>

      <Animated.View style={a(bodyAnim)}>
        <Text style={styles.body}>
          <Text style={styles.bodyBold}>People who talk about how they feel</Text> recover from stress 3 times faster than those who keep it inside.
        </Text>
        <Text style={styles.tagline}>Keeping it in makes it heavier.</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View style={a(btnAnim, 10)}>
        <TouchableOpacity style={styles.btn} onPress={onContinue} activeOpacity={0.8}>
          <Text style={styles.btnText}>Keep going</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignSelf: 'stretch',
    paddingBottom: 8,
    gap: 16,
  },
  heading: {
    fontSize: 46,
    fontFamily: 'Outfit-Bold',
    color: '#8B7EF8',
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  statCard: {
    borderRadius: 24,
    borderColor: '#8b7ef84d',
    borderWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statNumber: {
    fontSize: 58,
    fontFamily: 'Outfit-Bold',
    color: '#8B7EF8',
    lineHeight: 62,
  },
  statX: {
    fontSize: 40,
    fontFamily: 'Outfit-Bold',
    color: '#8B7EF8',
  },
  statDivider: {
    width: 1.5,
    height: 50,
    backgroundColor: '#8b7ef84d',
    borderRadius: 10,
  },
  statLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#8B7EF8',
    lineHeight: 23,
  },
  body: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#4A4A6A',
    lineHeight: 23,
  },
  bodyBold: {
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: '#8B7EF8',
  },
  btn: {
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
  btnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 17,
    color: '#FFFFFF',
  },
});
