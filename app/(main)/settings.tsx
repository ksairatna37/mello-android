/**
 * Settings Screen
 * App settings, crisis resources, legal, logout
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, Shadows } from '@/constants/spacing';

interface SettingsItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isDestructive?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  isDestructive,
}) => (
  <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
    <Text style={styles.settingsIcon}>{icon}</Text>
    <View style={styles.settingsItemContent}>
      <Text
        style={[
          styles.settingsTitle,
          isDestructive && styles.settingsDestructive,
        ]}
      >
        {title}
      </Text>
      {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
    </View>
    <Text style={styles.settingsChevron}>{'\u203A'}</Text>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();

  const handleCrisisResources = () => {
    Alert.alert(
      'Crisis Support',
      'If you\'re in crisis, help is available:\n\n' +
        '📞 National Suicide Prevention Lifeline: 988\n\n' +
        '💬 Crisis Text Line: Text HOME to 741741\n\n' +
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
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          // TODO: Implement logout
          router.replace('/');
        },
      },
    ]);
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
            // TODO: Implement account deletion
            console.log('Delete account');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Crisis Resources - Always visible and prominent */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionCard}>
            <SettingsItem
              icon={'\u{1F198}'}
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
              icon={'\u{1F4E7}'}
              title="Email"
              subtitle="user@example.com"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon={'\u{1F512}'}
              title="Change Password"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.sectionCard}>
            <SettingsItem
              icon={'\u{1F4DC}'}
              title="Privacy Policy"
              onPress={handlePrivacyPolicy}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon={'\u{1F4C4}'}
              title="Terms of Service"
              onPress={handleTermsOfService}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <View style={styles.sectionCard}>
            <SettingsItem
              icon={'\u{1F6AA}'}
              title="Sign Out"
              onPress={handleLogout}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon={'\u{1F5D1}\uFE0F'}
              title="Delete Account"
              onPress={handleDeleteAccount}
              isDestructive
            />
          </View>
        </View>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>mello</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.disclaimer}>
            Mello is not a replacement for professional mental health care.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.mello.light,
  },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  settingsSubtitle: {
    fontSize: 14,
    color: Colors.light.textMuted,
    marginTop: 2,
  },
  settingsDestructive: {
    color: Colors.light.error,
  },
  settingsChevron: {
    fontSize: 24,
    color: Colors.light.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 56,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.lg,
  },
  appName: {
    fontSize: 24,
    fontWeight: '300',
    fontStyle: 'italic',
    color: Colors.mello.purple,
    letterSpacing: 1,
  },
  appVersion: {
    fontSize: 14,
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.light.textMuted,
    marginTop: Spacing.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 18,
  },
});
