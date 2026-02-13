/**
 * Crisis Check Bottom Sheet
 * Shows when user selects "Struggling" on mood-weight screen
 *
 * Emotionally-aware UX:
 * - Calm, supportive tone (not alarming)
 * - User chooses safety status
 * - Conditional support button (only when needed)
 * - Two-step call flow (user picks helpline)
 * - Soft skip option ("Not right now")
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 520;

// Safety options
const SAFETY_OPTIONS = [
  { id: 'safe', label: "Yes, I'm safe" },
  { id: 'need-help', label: 'No, I need help right now' },
  { id: 'not-sure', label: 'Not sure' },
];

// Helpline options for the picker
const HELPLINES = [
  { id: 'aasra', name: 'AASRA', number: '9820466626', available: '24/7' },
  { id: 'vandrevala', name: 'Vandrevala Foundation', number: '18602662345', available: '24/7' },
  { id: 'emergency', name: 'Emergency Services', number: '112', available: '24/7' },
];

// Ease out curve - no spring, no bounce
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

interface CrisisCheckSheetProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

// Animated Checkbox Option
const SafetyOption = ({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const animatedValue = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    animatedValue.value = withTiming(isSelected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isSelected]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(245, 240, 235, ${1 + animatedValue.value * 0.06})`,
    borderWidth: 1.5 + animatedValue.value * 0.5,
    borderColor: `rgba(200, 195, 190, ${0.6 + animatedValue.value * 0.4})`,
  }));

  const checkboxStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
    transform: [{ scale: 0.8 + animatedValue.value * 0.2 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={[styles.optionCard, containerStyle]}>
        <Text style={styles.optionText}>{label}</Text>
        <Animated.View style={[styles.checkbox, checkboxStyle]}>
          <View style={styles.checkboxFilled}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function CrisisCheckSheet({
  visible,
  onClose,
  onContinue,
}: CrisisCheckSheetProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showHelplinePicker, setShowHelplinePicker] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  // Check if user needs support (not safe or not sure)
  const needsSupport = selectedOption === 'need-help' || selectedOption === 'not-sure';

  const hideModal = useCallback(() => {
    setIsVisible(false);
    setSelectedOption(null);
    setShowHelplinePicker(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 350, easing: EASE_OUT });
      translateY.value = withTiming(0, { duration: 400, easing: EASE_OUT });
      scale.value = withTiming(1, { duration: 350, easing: EASE_OUT });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
      scale.value = withTiming(0.96, { duration: 300, easing: EASE_OUT });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350, easing: EASE_OUT }, (finished) => {
        if (finished) {
          runOnJS(hideModal)();
        }
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
    scale.value = withTiming(0.96, { duration: 300, easing: EASE_OUT });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350, easing: EASE_OUT }, (finished) => {
      if (finished) {
        runOnJS(hideModal)();
      }
    });
  };

  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleGetSupport = () => {
    setShowHelplinePicker(true);
  };

  const handleCallHelpline = (number: string) => {
    Linking.openURL(`tel:${number}`);
    setShowHelplinePicker(false);
  };

  const handleContinue = () => {
    handleClose();
    // Small delay to let animation complete
    setTimeout(() => {
      onContinue();
    }, 400);
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Main Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          <View style={[styles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
            {!showHelplinePicker ? (
              <>
                {/* Title */}
                <Text style={styles.title}>Are you safe right now?</Text>

                {/* Safety Options */}
                <View style={styles.optionsContainer}>
                  {SAFETY_OPTIONS.map((option) => (
                    <SafetyOption
                      key={option.id}
                      label={option.label}
                      isSelected={selectedOption === option.id}
                      onPress={() => handleOptionSelect(option.id)}
                    />
                  ))}
                </View>

                {/* Helpline Resources - Always visible but subtle */}
                <View style={styles.resourcesContainer}>
                  <Text style={styles.resourcesTitle}>If you need immediate support:</Text>
                  <Text style={styles.resourcesText}>AASRA: 9820466626 (24/7)</Text>
                  <Text style={styles.resourcesText}>Vandrevala: 1860 2662 345 (24/7)</Text>
                  <Text style={styles.resourcesText}>Emergency: 112</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonsContainer}>
                  {/* Get Support Button - Only prominent when user needs help */}
                  {needsSupport && (
                    <TouchableOpacity
                      style={styles.supportButton}
                      onPress={handleGetSupport}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.supportButtonText}>Talk to someone now</Text>
                      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}

                  {/* Continue/Skip Button */}
                  <TouchableOpacity
                    style={[
                      styles.skipButton,
                      needsSupport && styles.skipButtonSecondary,
                    ]}
                    onPress={handleContinue}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.skipButtonText,
                        needsSupport && styles.skipButtonTextSecondary,
                      ]}
                    >
                      {selectedOption === 'safe' ? "I'll continue" : 'Not right now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Helpline Picker */}
                <Text style={styles.pickerTitle}>Who would you like to talk to?</Text>

                <View style={styles.helplineList}>
                  {HELPLINES.map((helpline) => (
                    <TouchableOpacity
                      key={helpline.id}
                      style={styles.helplineOption}
                      onPress={() => handleCallHelpline(helpline.number)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.helplineInfo}>
                        <Text style={styles.helplineName}>{helpline.name}</Text>
                        <Text style={styles.helplineNumber}>
                          {helpline.number} ({helpline.available})
                        </Text>
                      </View>
                      <Ionicons name="call" size={22} color="#4A90A4" />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowHelplinePicker(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backButtonText}>Go back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: SHEET_HEIGHT,
    zIndex: 999,
    overflow: 'hidden',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // Title
  title: {
    fontSize: 24,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  // Options
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#F5F0EB',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 195, 190, 0.6)',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Resources
  resourcesContainer: {
    backgroundColor: 'rgba(245, 240, 235, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  resourcesTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#666',
    marginBottom: 8,
  },
  resourcesText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#888',
    marginBottom: 4,
  },
  // Buttons
  buttonsContainer: {
    gap: 12,
  },
  supportButton: {
    backgroundColor: '#4A90A4', // Calm teal, not aggressive red
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  supportButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  skipButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 30,
    alignItems: 'center',
  },
  skipButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  skipButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  skipButtonTextSecondary: {
    color: '#666',
  },
  // Helpline Picker
  pickerTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  helplineList: {
    gap: 12,
    marginBottom: 24,
  },
  helplineOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 240, 235, 0.8)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 195, 190, 0.4)',
  },
  helplineInfo: {
    flex: 1,
  },
  helplineName: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  helplineNumber: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#666',
  },
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#666',
  },
});
