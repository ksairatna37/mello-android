/**
 * AnimatedText Component
 * Apple Music-style word-by-word text fill animation
 * Supports paragraphs with \n\n separator
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface AnimatedTextProps {
  text: string;
  style?: any;
  activeColor?: string;
  inactiveColor?: string;
  delayPerWord?: number;
  wordDuration?: number;
  startDelay?: number;
  paragraphDelay?: number;  // Delay between paragraphs
  onComplete?: () => void;
}

// Individual word component with its own animation
function WordItem({
  word,
  delay,
  wordDuration,
  activeColor,
  style,
  isLast,
}: {
  word: string;
  delay: number;
  wordDuration: number;
  activeColor: string;
  style: any;
  isLast: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: wordDuration,
        easing: Easing.out(Easing.ease),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + (progress.value * 0.7),
  }));

  return (
    <Animated.Text style={[style, { color: activeColor }, animatedStyle]}>
      {word}{isLast ? '' : ' '}
    </Animated.Text>
  );
}

// Single paragraph component
function Paragraph({
  words,
  startDelay,
  delayPerWord,
  wordDuration,
  activeColor,
  style,
}: {
  words: string[];
  startDelay: number;
  delayPerWord: number;
  wordDuration: number;
  activeColor: string;
  style: any;
}) {
  return (
    <View style={styles.paragraph}>
      {words.map((word, index) => (
        <WordItem
          key={`${index}-${word}`}
          word={word}
          delay={startDelay + index * delayPerWord}
          wordDuration={wordDuration}
          activeColor={activeColor}
          style={style}
          isLast={index === words.length - 1}
        />
      ))}
    </View>
  );
}

export default function AnimatedText({
  text,
  style,
  activeColor = '#FFFFFF',
  inactiveColor = 'rgba(255, 255, 255, 0.3)',
  delayPerWord = 100,
  wordDuration = 300,
  startDelay = 0,
  paragraphDelay = 1800,
  onComplete,
}: AnimatedTextProps) {
  // Split text into paragraphs by \n\n, then each paragraph into words
  const paragraphs = useMemo(() => {
    return text.split('\n\n').map(p => p.trim()).filter(p => p.length > 0);
  }, [text]);

  // Calculate timing for each paragraph
  const paragraphData = useMemo(() => {
    let currentDelay = startDelay;

    return paragraphs.map((paragraph, pIndex) => {
      const words = paragraph.split(' ').filter(w => w.length > 0);
      const paragraphStartDelay = currentDelay;

      // Calculate when this paragraph ends
      const paragraphDuration = words.length * delayPerWord + wordDuration;

      // Next paragraph starts after this one + paragraphDelay
      currentDelay = paragraphStartDelay + paragraphDuration + paragraphDelay;

      return {
        words,
        startDelay: paragraphStartDelay,
      };
    });
  }, [paragraphs, startDelay, delayPerWord, wordDuration, paragraphDelay]);

  // Calculate total animation duration and trigger onComplete
  useEffect(() => {
    if (onComplete) {
      const lastParagraph = paragraphData[paragraphData.length - 1];
      const totalDuration = lastParagraph.startDelay +
        lastParagraph.words.length * delayPerWord + wordDuration;

      const timer = setTimeout(onComplete, totalDuration);
      return () => clearTimeout(timer);
    }
  }, [onComplete, paragraphData, delayPerWord, wordDuration]);

  return (
    <View style={styles.container}>
      {paragraphData.map((data, index) => (
        <Paragraph
          key={index}
          words={data.words}
          startDelay={data.startDelay}
          delayPerWord={delayPerWord}
          wordDuration={wordDuration}
          activeColor={activeColor}
          style={style}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  paragraph: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
});
