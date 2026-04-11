/**
 * VoiceInfoSheet
 * Bottom sheet shown when the info button in the voice screen header is tapped.
 * Follows the exact same pattern as SignOutBottomSheet / CrisisBottomSheet.
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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoiceInfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceInfoSheet({ visible, onClose }: VoiceInfoSheetProps) {
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
      translateY.value = withSpring(0, { damping: 50, stiffness: 150, mass: 0.5 });
      scale.value = withSpring(1, { damping: 50, stiffness: 150, mass: 0.8 });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(0.96, { duration: 300 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
        if (finished) runOnJS(hideModal)();
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 300 });
    scale.value = withTiming(0.96, { duration: 300 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={styles.handleBar} />

          <View style={[styles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
            <Text style={styles.title}>mello <Text style={{ fontFamily: 'Outfit-Regular' }}>voice</Text></Text>
            <Text style={styles.subtitle}>
              A safe space to talk out loud — <Text style={{ fontFamily: 'Playwrite' }}>mello</Text> listens, understands, and responds with care.
            </Text>

            <View style={styles.rows}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color="#b9a6ff" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Private & Confidential</Text>
                  <Text style={styles.rowDesc}>Your conversations are not shared nor used to train AI models.</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="heart-outline" size={18} color="#b9a6ff" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Trauma-informed AI</Text>
                  <Text style={styles.rowDesc}>Trained to support and understand, never to judge or advise.</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="mic-outline" size={18} color="#b9a6ff" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Real-time voice AI</Text>
                  <Text style={styles.rowDesc}>Powered by Empathic Voice Interface — detects tone, not just words.</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Got it</Text>
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
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  title: {
    fontFamily: 'Playwrite',
    fontSize: 22,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  rows: {
    gap: 16,
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(185,166,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  rowDesc: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  closeBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
