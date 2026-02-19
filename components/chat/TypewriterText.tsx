/**
 * TypewriterText Component
 * Character-by-character text reveal animation
 * Port of web's TypewriterText.tsx
 */

import React, { useState, useEffect } from 'react';
import { Text, TextStyle } from 'react-native';

interface TypewriterTextProps {
  text: string;
  speed?: number; // ms per character
  style?: TextStyle;
  onComplete?: () => void;
}

export default function TypewriterText({
  text,
  speed = 25,
  style,
  onComplete,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  // Advance one character at a time
  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && text.length > 0) {
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete]);

  return <Text style={style}>{displayedText}</Text>;
}
