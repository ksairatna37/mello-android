/**
 * OTP Input Component
 * 6-digit code input with individual boxes
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

const OTP_LENGTH = 6;

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  hasError?: boolean;
  autoFocus?: boolean;
}

export default function OTPInput({
  value,
  onChange,
  onComplete,
  hasError = false,
  autoFocus = true,
}: OTPInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Split value into array of digits
  const digits = value.split('').concat(Array(OTP_LENGTH - value.length).fill(''));

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleChangeText = (text: string, index: number) => {
    // Only accept single digit
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    if (digit) {
      // Update value
      const newDigits = [...digits];
      newDigits[index] = digit;
      const newValue = newDigits.join('').slice(0, OTP_LENGTH);
      onChange(newValue);

      // Move to next input
      if (index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if complete
      if (newValue.length === OTP_LENGTH && onComplete) {
        onComplete(newValue);
      }
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
        // Clear previous digit
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
      } else {
        // Clear current digit
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const handleBoxPress = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        const isFilled = digit !== '';

        return (
          <Pressable
            key={index}
            style={[
              styles.box,
              isFocused && styles.boxFocused,
              hasError && isFilled && styles.boxError,
            ]}
            onPress={() => handleBoxPress(index)}
          >
            {/* Display digit */}
            <Text style={[styles.digit, hasError && isFilled && styles.digitError]}>
              {digit}
            </Text>

            {/* Hidden input for keyboard */}
            <TextInput
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={styles.hiddenInput}
              value={digit}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              keyboardType="number-pad"
              maxLength={1}
              caretHidden
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  boxFocused: {
    borderColor: '#1A1A1A',
  },
  boxError: {
    borderColor: '#FF4444',
    backgroundColor: '#FFF5F5',
  },
  digit: {
    fontSize: 28,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  digitError: {
    color: '#FF4444',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
});
