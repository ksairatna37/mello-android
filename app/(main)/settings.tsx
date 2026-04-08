/**
 * Settings Screen - Light Theme
 * Clean white cards with soft shadows
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import MelloGradient from '@/components/common/MelloGradient';
import { useAuth } from '@/contexts/AuthContext';
import SignOutBottomSheet from '@/components/settings/SignOutBottomSheet';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isDestructive?: boolean;
}

const SettingsItem = ({
  icon,
  title,
  subtitle,
  onPress,
  isDestructive,
}: SettingsItemProps) => (
  <Pressable style={styles.settingsItem} onPress={onPress}>
    <View style={[styles.settingsIconCircle, isDestructive && styles.iconDestructive]}>
      <Ionicons
        name={icon}
        size={20}
        color={isDestructive ? '#E53E3E' : LIGHT_THEME.accent}
      />
    </View>
    <View style={styles.settingsItemContent}>
      <Text style={[styles.settingsTitle, isDestructive && styles.settingsDestructive]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={LIGHT_THEME.textMuted} />
  </Pressable>
);

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, user, emailUser, loading } = useAuth();
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Get current user email for display
  const currentEmail = user?.email || emailUser?.email || 'user@example.com';

  const handleCrisisResources = () => {
    Alert.alert(
      'Crisis Support',
      'If you\'re in crisis, help is available:\n\n' +
        'National Suicide Prevention Lifeline: 988\n\n' +
        'Crisis Text Line: Text HOME to 741741\n\n' +
        'You are not alone. Help is always available.',
      [
        { text: 'Call 988', onPress: () => Linking.openURL('tel:988') },
        {
          text: 'Text 741741',
          onPress: () => Linking.openURL('sms:741741?body=HOME'),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MelloGradient />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: 20 },
        ]}
      >
        {/* Header */}
        <Text style={styles.headerTitle}>Settings</Text>

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
              onPress={() => router.push('/change-password')}
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

  headerTitle: {
    fontSize: 28,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    marginBottom: 24,
  },

  section: {
    marginBottom: 20,
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
  settingsItemContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textPrimary,
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
