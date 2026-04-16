/**
 * Settings Screen - Light Theme
 * Clean white cards with soft shadows
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Alert,
  StatusBar,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import MelloGradient from '@/components/common/MelloGradient';
import { useAuth } from '@/contexts/AuthContext';
import SignOutBottomSheet from '@/components/settings/SignOutBottomSheet';
import CrisisCheckSheet from '@/components/onboarding/CrisisCheckSheet';
import { getOnboardingData } from '@/utils/onboardingStorage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isDestructive?: boolean;
  muted?: boolean;
}

const SettingsItem = ({
  icon,
  title,
  subtitle,
  onPress,
  isDestructive,
  muted,
}: SettingsItemProps) => (
  <Pressable style={[styles.settingsItem, muted && styles.settingsItemMuted]} onPress={onPress}>
    <View style={[styles.settingsIconCircle, isDestructive && styles.iconDestructive, muted && styles.iconMuted]}>
      <Ionicons
        name={icon}
        size={20}
        color={isDestructive ? '#E53E3E' : muted ? LIGHT_THEME.textMuted : LIGHT_THEME.accent}
      />
    </View>
    <View style={styles.settingsItemContent}>
      <Text style={[styles.settingsTitle, isDestructive && styles.settingsDestructive, muted && styles.settingsMuted]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={muted ? '#C0C0C0' : LIGHT_THEME.textMuted} />
  </Pressable>
);

// ─── Google Auth Bottom Sheet ────────────────────────────────────────────────

interface GoogleAuthSheetProps {
  visible: boolean;
  onClose: () => void;
}

function GoogleAuthSheet({ visible, onClose }: GoogleAuthSheetProps) {
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
      <View style={{ flex: 1 }}>
        <Animated.View style={[gaStyles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[gaStyles.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={gaStyles.handleBar} />
          <View style={[gaStyles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
            {/* Google icon badge */}
            <View style={gaStyles.iconBadge}>
              <Ionicons name="logo-google" size={28} color="#4285F4" />
            </View>

            <Text style={gaStyles.title}>Signed in with Google</Text>
            <Text style={gaStyles.subtitle}>
              Your account uses Google Sign-In. To change your password, manage it through your Google account settings.
            </Text>

            <TouchableOpacity style={gaStyles.gotItButton} onPress={handleClose} activeOpacity={0.85}>
              <Text style={gaStyles.gotItText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, user, emailUser, loading } = useAuth();
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [showCrisisSheet, setShowCrisisSheet] = useState(false);
  const [showGoogleAuthSheet, setShowGoogleAuthSheet] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);

  // Get current user email for display
  const currentEmail = user?.email || emailUser?.email || 'user@example.com';
  
  // Check if user is logged in with Google auth
  const isGoogleAuth = !!user && !emailUser;

  // Check onboarding completion on mount
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const data = await getOnboardingData();
        setIsOnboardingCompleted(!!data.onboardingCompleted);
      } catch (err) {
        console.error('Error checking onboarding status:', err);
      }
    }
    checkOnboarding();
  }, []);

  const handleCrisisResources = () => {
    setShowCrisisSheet(true);
  };

  const handleCrisisSheetClose = () => {
    setShowCrisisSheet(false);
  };

  const handleCrisisSheetContinue = () => {
    setShowCrisisSheet(false);
  };

  const handleTalkToMello = () => {
    setShowCrisisSheet(false);
    // Navigate to chat tab
    router.navigate('/(main)/chat' as any);
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://melloai.health/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://melloai.health/terms');
  };

  const handleLogout = () => {
    setShowSignOutSheet(true);
  };

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setShowSignOutSheet(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            console.log('Delete account');
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    if (isGoogleAuth) {
      setShowGoogleAuthSheet(true);
    } else {
      router.push('/change-password');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MelloGradient />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 20 },
        ]}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerCenter}>
            <Text style={styles.logoText}>mello</Text>
            <Text style={styles.headerSubtitle}>Settings</Text>
          </View>
        </View>

        {/* Crisis Resources - Prominent */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionCardHighlight}>
            <SettingsItem
              icon="heart-outline"
              title="Crisis Resources"
              subtitle="Get help when you need it"
              onPress={handleCrisisResources}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            <SettingsItem
              icon="mail-outline"
              title="Email"
              subtitle={currentEmail}
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="lock-closed-outline"
              title="Change Password"
              onPress={handleChangePassword}
              muted={isGoogleAuth}
            />
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.sectionCard}>
            <SettingsItem
              icon="shield-outline"
              title="Privacy Policy"
              onPress={handlePrivacyPolicy}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="document-text-outline"
              title="Terms of Service"
              onPress={handleTermsOfService}
            />
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <View style={styles.sectionCard}>
            <SettingsItem
              icon="log-out-outline"
              title="Sign Out"
              onPress={handleLogout}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="trash-outline"
              title="Delete Account"
              onPress={handleDeleteAccount}
              isDestructive
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>mello</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.disclaimer}>
            Mello is not a replacement for professional mental health care.
          </Text>
        </View>
      </ScrollView>

      {/* Sign Out Bottom Sheet */}
      <SignOutBottomSheet
        visible={showSignOutSheet}
        onClose={() => setShowSignOutSheet(false)}
        onSignOut={handleConfirmSignOut}
        loading={signingOut}
      />

      {/* Crisis Check Sheet */}
      <CrisisCheckSheet
        visible={showCrisisSheet}
        onClose={handleCrisisSheetClose}
        onContinue={handleCrisisSheetContinue}
        isOnboardingCompleted={isOnboardingCompleted}
        onTalkToMello={handleTalkToMello}
      />

      {/* Google Auth Sheet */}
      <GoogleAuthSheet
        visible={showGoogleAuthSheet}
        onClose={() => setShowGoogleAuthSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logoText: {
    fontFamily: 'Playwrite',
    fontSize: 26,
    color: '#1A1A1A',
    lineHeight: 32,
    marginBottom: 10,
  },
  headerSubtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
  },

  headerTitle: {
    fontSize: 28,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    marginBottom: 24,
  },

  section: {
    marginBottom: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textMuted,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  sectionCardHighlight: {
    backgroundColor: LIGHT_THEME.accentLight,
    borderRadius: 20,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsItemMuted: {
    opacity: 0.5,
  },
  settingsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIGHT_THEME.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconDestructive: {
    backgroundColor: '#FED7D7',
  },
  iconMuted: {
    backgroundColor: '#E0E0E0',
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textPrimary,
  },
  settingsMuted: {
    color: LIGHT_THEME.textMuted,
  },
  settingsSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    marginTop: 2,
  },
  settingsDestructive: {
    color: '#E53E3E',
  },
  divider: {
    height: 1,
    backgroundColor: LIGHT_THEME.border,
    marginLeft: 66,
  },

  appInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  appName: {
    fontSize: 28,
    fontFamily: 'Playwrite',
    color: LIGHT_THEME.accent,
  },
  appVersion: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
    marginTop: 4,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});

// ─── Google Auth Sheet Styles ───────────────────────────────────────────────

const gaStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 320,
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
    alignItems: 'center',
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  gotItButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
    alignSelf: 'center',
  },
  gotItText: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
