/**
 * Animated Mood Character Component
 * Each mood has a unique character with distinct features
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Ellipse, Rect, G } from 'react-native-svg';

const AnimatedView = Animated.createAnimatedComponent(View);

export type MoodType = 'joy' | 'anxiety' | 'distracted' | 'surprised' | 'sad' | 'calm';

interface MoodCharacterProps {
  mood: MoodType;
  size?: number;
}

// Joy Character - Orange blob with cloud hair and happy face
const JoyCharacter = ({ size }: { size: number }) => {
  const bounceAnim = useSharedValue(0);
  const blinkAnim = useSharedValue(1);

  useEffect(() => {
    // Gentle bounce
    bounceAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Blink animation
    blinkAnim.value = withRepeat(
      withSequence(
        withDelay(2000, withTiming(0, { duration: 100 })),
        withTiming(1, { duration: 100 })
      ),
      -1,
      false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bounceAnim.value, [0, 1], [0, -8]) },
      { scaleY: interpolate(bounceAnim.value, [0, 1], [1, 1.02]) },
    ],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blinkAnim.value }],
  }));

  return (
    <AnimatedView style={[styles.characterContainer, { width: size, height: size * 1.2 }, bodyStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
        {/* Cloud-like hair bumps */}
        <Circle cx="50" cy="45" r="35" fill="#E85D3B" />
        <Circle cx="100" cy="35" r="40" fill="#E85D3B" />
        <Circle cx="150" cy="45" r="35" fill="#E85D3B" />
        <Circle cx="75" cy="55" r="30" fill="#E85D3B" />
        <Circle cx="125" cy="55" r="30" fill="#E85D3B" />

        {/* Main body */}
        <Path
          d="M20 80 Q20 240 100 240 Q180 240 180 80 Q180 60 100 60 Q20 60 20 80"
          fill="#E85D3B"
        />

        {/* Eyes - white rectangles with rounded corners */}
        <G transform="translate(55, 120)">
          <Rect x="0" y="0" width="25" height="35" rx="5" fill="white" />
        </G>
        <G transform="translate(120, 120)">
          <Rect x="0" y="0" width="25" height="35" rx="5" fill="white" />
        </G>

        {/* Happy smile */}
        <Path
          d="M70 175 Q100 210 130 175"
          stroke="#1a1a1a"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Teeth */}
        <Rect x="85" y="175" width="12" height="15" rx="2" fill="white" />
        <Rect x="102" y="175" width="12" height="15" rx="2" fill="white" />
      </Svg>
    </AnimatedView>
  );
};

// Anxiety Character - Green blob with beanie and teardrops
const AnxietyCharacter = ({ size }: { size: number }) => {
  const shakeAnim = useSharedValue(0);
  const tearAnim = useSharedValue(0);

  useEffect(() => {
    // Subtle shake
    shakeAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withDelay(1500, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );

    // Tear drop animation
    tearAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value * 2 }],
  }));

  const tearStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tearAnim.value, [0, 0.5, 1], [0, 1, 0]),
    transform: [{ translateY: interpolate(tearAnim.value, [0, 1], [0, 30]) }],
  }));

  return (
    <AnimatedView style={[styles.characterContainer, { width: size, height: size * 1.2 }, bodyStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
        {/* Main body */}
        <Path
          d="M30 60 Q30 240 100 240 Q170 240 170 60 Q170 40 100 40 Q30 40 30 60"
          fill="#2D8B57"
        />

        {/* Beanie */}
        <Path
          d="M35 70 Q35 30 100 30 Q165 30 165 70"
          fill="#2D8B57"
        />
        <Ellipse cx="100" cy="70" rx="70" ry="15" fill="#2D8B57" />

        {/* Beanie stripes */}
        <Path d="M40 55 Q100 45 160 55" stroke="#F5B5C8" strokeWidth="6" fill="none" />
        <Path d="M38 65 Q100 55 162 65" stroke="#87CEEB" strokeWidth="6" fill="none" />
        <Path d="M40 75 Q100 65 160 75" stroke="#F5D93A" strokeWidth="4" fill="none" />

        {/* Beanie top pom */}
        <Circle cx="100" cy="25" r="12" fill="#2D8B57" />

        {/* Eyes - worried, different sizes */}
        <Circle cx="75" cy="130" r="18" fill="#1a1a1a" />
        <Circle cx="130" cy="140" r="14" fill="#1a1a1a" />

        {/* Worried eyebrows */}
        <Path d="M55 105 L90 115" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
        <Path d="M145 120 L115 115" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />

        {/* Small worried mouth */}
        <Ellipse cx="100" cy="185" rx="8" ry="6" fill="#1a1a1a" />

        {/* Teardrops */}
        <G transform="translate(145, 135)">
          <Path d="M0 0 Q5 15 0 25 Q-5 15 0 0" fill="#4FA8DE" />
        </G>
        <G transform="translate(155, 155)">
          <Path d="M0 0 Q3 10 0 18 Q-3 10 0 0" fill="#4FA8DE" />
        </G>
      </Svg>
    </AnimatedView>
  );
};

// Distracted Character - Purple/blue blob with swirly eyes
const DistractedCharacter = ({ size }: { size: number }) => {
  const rotateAnim = useSharedValue(0);
  const floatAnim = useSharedValue(0);

  useEffect(() => {
    rotateAnim.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );

    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(floatAnim.value, [0, 1], [0, -10]) },
      { rotate: `${interpolate(floatAnim.value, [0, 0.5, 1], [-2, 2, -2])}deg` },
    ],
  }));

  return (
    <AnimatedView style={[styles.characterContainer, { width: size, height: size * 1.2 }, bodyStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
        {/* Main body - blob shape */}
        <Path
          d="M25 80 Q15 240 100 240 Q185 240 175 80 Q175 50 100 50 Q25 50 25 80"
          fill="#8B5CF6"
        />

        {/* Swirl on top */}
        <Path
          d="M100 55 Q120 35 100 25 Q80 15 95 5"
          stroke="#8B5CF6"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
        />

        {/* Dizzy spiral eyes */}
        <G transform="translate(65, 120)">
          <Circle cx="15" cy="15" r="20" fill="white" />
          <Path d="M15 5 Q25 15 15 15 Q5 15 15 25" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        </G>
        <G transform="translate(115, 120)">
          <Circle cx="15" cy="15" r="20" fill="white" />
          <Path d="M15 5 Q25 15 15 15 Q5 15 15 25" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        </G>

        {/* Confused wavy mouth */}
        <Path
          d="M70 185 Q85 190 100 185 Q115 180 130 185"
          stroke="#1a1a1a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </AnimatedView>
  );
};

// Surprised Character - Yellow blob with wide eyes
const SurprisedCharacter = ({ size }: { size: number }) => {
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
        withDelay(1000, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulseAnim.value, [0, 1], [1, 1.05]) },
    ],
  }));

  return (
    <AnimatedView style={[styles.characterContainer, { width: size, height: size * 1.2 }, bodyStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
        {/* Hair spikes (surprised) */}
        <Path d="M60 50 L50 20 L70 45" fill="#FFB800" />
        <Path d="M90 40 L85 5 L105 35" fill="#FFB800" />
        <Path d="M120 40 L125 5 L135 35" fill="#FFB800" />
        <Path d="M145 50 L160 20 L150 45" fill="#FFB800" />

        {/* Main body */}
        <Path
          d="M25 70 Q20 240 100 240 Q180 240 175 70 Q175 45 100 45 Q25 45 25 70"
          fill="#FFB800"
        />

        {/* Wide surprised eyes */}
        <Circle cx="70" cy="130" r="28" fill="white" />
        <Circle cx="130" cy="130" r="28" fill="white" />
        <Circle cx="70" cy="130" r="14" fill="#1a1a1a" />
        <Circle cx="130" cy="130" r="14" fill="#1a1a1a" />
        <Circle cx="75" cy="125" r="5" fill="white" />
        <Circle cx="135" cy="125" r="5" fill="white" />

        {/* Raised eyebrows */}
        <Path d="M45 90 Q70 80 95 95" stroke="#1a1a1a" strokeWidth="5" fill="none" strokeLinecap="round" />
        <Path d="M105 95 Q130 80 155 90" stroke="#1a1a1a" strokeWidth="5" fill="none" strokeLinecap="round" />

        {/* Open mouth (O shape) */}
        <Ellipse cx="100" cy="190" rx="20" ry="25" fill="#1a1a1a" />
      </Svg>
    </AnimatedView>
  );
};

// Sad Character - Blue blob with droopy features
const SadCharacter = ({ size }: { size: number }) => {
  const droopAnim = useSharedValue(0);
  const tearAnim = useSharedValue(0);

  useEffect(() => {
    droopAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    tearAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(droopAnim.value, [0, 1], [0, 5]) },
    ],
  }));

  return (
    <AnimatedView style={[styles.characterContainer, { width: size, height: size * 1.2 }, bodyStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
        {/* Droopy top */}
        <Ellipse cx="100" cy="55" rx="75" ry="25" fill="#5B8DEF" />

        {/* Main body */}
        <Path
          d="M25 55 Q20 240 100 240 Q180 240 175 55"
          fill="#5B8DEF"
        />

        {/* Sad droopy eyes */}
        <Ellipse cx="70" cy="130" rx="20" ry="15" fill="white" />
        <Ellipse cx="130" cy="130" rx="20" ry="15" fill="white" />
        <Circle cx="70" cy="133" r="8" fill="#1a1a1a" />
        <Circle cx="130" cy="133" r="8" fill="#1a1a1a" />

        {/* Sad eyebrows */}
        <Path d="M50 115 Q70 125 90 115" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <Path d="M110 115 Q130 125 150 115" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* Sad frown */}
        <Path
          d="M70 190 Q100 175 130 190"
          stroke="#1a1a1a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tear */}
        <Path d="M85 145 Q90 165 85 175 Q80 165 85 145" fill="#87CEEB" />
      </Svg>
    </AnimatedView>
  );
};

// Calm Character - Teal blob with peaceful closed eyes
const CalmCharacter = ({ size }: { size: number }) => {
  const breatheAnim = useSharedValue(0);

  useEffect(() => {
    breatheAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: interpolate(breatheAnim.value, [0, 1], [1, 1.03]) },
      { scaleX: interpolate(breatheAnim.value, [0, 1], [1, 0.98]) },
    ],
  }));

  return (
    <AnimatedView style={[styles.characterContainer, { width: size, height: size * 1.2 }, bodyStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
        {/* Smooth rounded top */}
        <Ellipse cx="100" cy="50" rx="70" ry="30" fill="#14B8A6" />

        {/* Main body */}
        <Path
          d="M30 50 Q25 240 100 240 Q175 240 170 50"
          fill="#14B8A6"
        />

        {/* Peaceful closed eyes (curved lines) */}
        <Path
          d="M55 130 Q70 140 85 130"
          stroke="#1a1a1a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M115 130 Q130 140 145 130"
          stroke="#1a1a1a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Rosy cheeks */}
        <Ellipse cx="50" cy="150" rx="15" ry="10" fill="#FF9999" opacity={0.5} />
        <Ellipse cx="150" cy="150" rx="15" ry="10" fill="#FF9999" opacity={0.5} />

        {/* Gentle smile */}
        <Path
          d="M80 180 Q100 195 120 180"
          stroke="#1a1a1a"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </AnimatedView>
  );
};

export const MoodCharacter: React.FC<MoodCharacterProps> = ({ mood, size = 250 }) => {
  const characters: Record<MoodType, React.ReactNode> = {
    joy: <JoyCharacter size={size} />,
    anxiety: <AnxietyCharacter size={size} />,
    distracted: <DistractedCharacter size={size} />,
    surprised: <SurprisedCharacter size={size} />,
    sad: <SadCharacter size={size} />,
    calm: <CalmCharacter size={size} />,
  };

  return <>{characters[mood]}</>;
};

const styles = StyleSheet.create({
  characterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MoodCharacter;
