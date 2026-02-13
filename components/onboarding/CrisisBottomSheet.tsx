/**
 * Crisis Bottom Sheet Component
 * Shows crisis helpline information when user taps info button
 */

import React, { useEffect, useCallback } from 'react';
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
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 250;

interface CrisisBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function CrisisBottomSheet({
  visible,
  onClose,
}: CrisisBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = React.useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 350 });
      translateY.value = withSpring(0, {
        damping: 50,
        stiffness: 150,
        mass: 0.5,
      });
      scale.value = withSpring(1, {
        damping: 50,
        stiffness: 150,
        mass: 0.8,
      });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(0.96, { duration: 300 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
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
    backdropOpacity.value = withTiming(0, { duration: 300 });
    scale.value = withTiming(0.96, { duration: 300 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
      if (finished) {
        runOnJS(hideModal)();
      }
    });
  };

  const handleCallPress = () => {
    Linking.openURL('tel:9820466626');
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Floating Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Content */}
          <View style={[styles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
            {/* Crisis Text */}
            <View style={styles.textContainer}>
              <Text style={styles.crisisTitle}>if you're in crisis right now:</Text>
              <Text style={styles.helplineText}>AASRA: 9820466626 (24/7)</Text>
            </View>

            {/* Call Button */}
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallPress}
              activeOpacity={0.8}
            >
              <Text style={styles.callButtonText}>Call for help</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    shadowOpacity: 0.25,
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
    marginBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  crisisTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  helplineText: {
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  callButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
