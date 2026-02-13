/**
 * Profile Screen
 * User profile display and edit
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, Shadows } from '@/constants/spacing';

export default function ProfileScreen() {
  // TODO: Get actual user data from auth context
  const username = 'Friend';
  const loginStreak = 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{'\u{1F60A}'}</Text>
          </View>
        </View>

        {/* Username */}
        <Text style={styles.username}>{username}</Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loginStreak}</Text>
            <Text style={styles.statLabel}>Day Streak {'\u{1F525}'}</Text>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Quote */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "Healing is not linear. It's OK to have good days and bad days."
          </Text>
          <Text style={styles.quoteAuthor}>- mello</Text>
        </View>
      </View>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xl,
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.mello.purple,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  username: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    backgroundColor: Colors.light.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    minWidth: 120,
    ...Shadows.sm,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.mello.purple,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  editButton: {
    backgroundColor: Colors.light.surface,
    paddingVertical: Spacing.buttonPadding.vertical,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.mello.purple,
    marginBottom: Spacing.xl,
  },
  editButtonText: {
    color: Colors.mello.purple,
    fontSize: 16,
    fontWeight: '500',
  },
  quoteCard: {
    backgroundColor: Colors.light.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    width: '100%',
    ...Shadows.sm,
  },
  quoteText: {
    fontSize: 16,
    color: Colors.light.text,
    fontStyle: 'italic',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  quoteAuthor: {
    fontSize: 14,
    color: Colors.mello.purple,
    textAlign: 'center',
    fontWeight: '500',
  },
});
