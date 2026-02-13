/**
 * Apple Sign In Bottom Sheet
 * Pixel-perfect clone of iOS Apple Sign In sheet
 */

import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AppleSignInSheetProps {
  visible: boolean;
  onClose: () => void;
  onContinue: (shareEmail: boolean) => void;
  userName?: string;
  userEmail?: string;
}

export default function AppleSignInSheet({
  visible,
  onClose,
  onContinue,
  userName = 'User',
  userEmail = 'user@example.com',
}: AppleSignInSheetProps) {
  const insets = useSafeAreaInsets();
  const [shareEmail, setShareEmail] = useState(true);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 150,
      });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, {
        damping: 20,
        stiffness: 150,
      });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleClose = () => {
    translateY.value = withSpring(SCREEN_HEIGHT, {
      damping: 20,
      stiffness: 150,
    });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onClose, 300);
  };

  const handleContinue = () => {
    onContinue(shareEmail);
  };

  // Generate hidden email
  const hiddenEmail = userEmail.split('@')[0].slice(0, 3) + '***@privaterelay.appleid.com';

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sign in with Apple</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <View style={styles.closeButtonInner}>
              <Ionicons name="close" size={16} color="#8E8E93" />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>m</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Create an account for{' '}
          <Text style={styles.descriptionBold}>mello</Text>
          {' '}using your{'\n'}Apple Account.
        </Text>

        {/* Name Field */}
        <View style={styles.fieldContainer}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldIcon}>
              <Ionicons name="person" size={20} color="#1C1C1E" />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.fieldValue}>{userName}</Text>
            </View>
            <TouchableOpacity style={styles.fieldAction}>
              <Ionicons name="close" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Email Options */}
        <View style={styles.fieldContainer}>
          {/* Share My Email Option */}
          <TouchableOpacity
            style={styles.emailOption}
            onPress={() => setShareEmail(true)}
            activeOpacity={0.7}
          >
            <View style={styles.fieldIcon}>
              <Ionicons name="mail" size={20} color="#1C1C1E" />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Share My Email</Text>
              <Text style={styles.fieldValue}>{userEmail}</Text>
            </View>
            <View style={[styles.radioButton, shareEmail && styles.radioButtonSelected]}>
              {shareEmail && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Hide My Email Option */}
          <TouchableOpacity
            style={styles.emailOption}
            onPress={() => setShareEmail(false)}
            activeOpacity={0.7}
          >
            <View style={styles.fieldIconPlaceholder} />
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Hide My Email</Text>
              <Text style={styles.fieldValueSmall}>Forward To: {userEmail}</Text>
            </View>
            <View style={[styles.radioButton, !shareEmail && styles.radioButtonSelected]}>
              {!shareEmail && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handleBar: {
    width: 36,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'System',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8E8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#FFE4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 36,
    fontFamily: 'Playwrite',
    color: '#FF6B35',
  },
  description: {
    fontSize: 17,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'System',
  },
  descriptionBold: {
    fontWeight: '600',
  },
  fieldContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emailOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fieldIconPlaceholder: {
    width: 40,
    marginRight: 12,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 15,
    color: '#8E8E93',
  },
  fieldValueSmall: {
    fontSize: 13,
    color: '#8E8E93',
  },
  fieldAction: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 68,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
