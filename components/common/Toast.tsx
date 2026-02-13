/**
 * Toast Component
 * Simple toast notification for showing messages
 */

import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide?: () => void;
  duration?: number;
  type?: 'error' | 'success' | 'info';
}

export default function Toast({
  message,
  visible,
  onHide,
  duration = 3000,
  type = 'error',
}: ToastProps) {
  const [isShowing, setIsShowing] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      setIsShowing(true);
      // Animate in
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsShowing(false);
          onHide?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIsShowing(false));
    }
  }, [visible]);

  if (!visible && !isShowing) return null;

  const backgroundColor = type === 'error' ? '#1A1A1A' : type === 'success' ? '#22C55E' : '#3B82F6';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  message: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
