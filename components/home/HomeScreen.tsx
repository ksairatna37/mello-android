/**
 * HomeScreen — dashboard with emotional battery, quick actions, daily affirmation.
 * Layout ported from the prototype's "🏠 Home Dashboard" (js/screens.js → home-main).
 * Bottom nav is rendered by `app/(main)/_layout.tsx` and is intentionally left alone.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MelloGradient from '@/components/common/MelloGradient';
import AffirmationCard from '@/components/home/AffirmationCard';
import EmotionalBatteryBlock from '@/components/home/EmotionalBatteryBlock';
import QuickActionCard from '@/components/home/QuickActionCard';
import { useHomeStats } from '@/components/home/useHomeStats';
import { BorderRadius, Shadows, Spacing } from '@/constants/spacing';
import { Colors, Gradients } from '@/constants/colors';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { getDailyAffirmation, refreshAffirmation } from '@/utils/affirmations';

// Backend team will expose real session time later. Until then every user
// has a flat 30-minute voice budget regardless of session count.
const VOICE_SESSION_BUDGET_MIN = 30;

const INITIAL_AFFIRMATION =
  "You showed up today. That's the hardest part. Everything else is just the next step.";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning ☀️';
  if (hour < 18) return 'Good afternoon 🌤️';
  return 'Good evening 🌙';
}

const ENTER_EASING = Easing.out(Easing.cubic);

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats } = useHomeStats();

  const [firstName, setFirstName] = useState<string>('');
  const [affirmation, setAffirmation] = useState<string>(INITIAL_AFFIRMATION);
  const [refreshingAffirmation, setRefreshingAffirmation] = useState(false);

  const handleRefreshAffirmation = useCallback(async () => {
    setRefreshingAffirmation(true);
    try {
      const next = await refreshAffirmation();
      setAffirmation(next);
    } finally {
      setRefreshingAffirmation(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const data = await getOnboardingData();
      if (data.firstName) setFirstName(data.firstName);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const quote = await getDailyAffirmation();
      if (!cancelled) setAffirmation(quote);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToMood = useCallback(() => {
    router.navigate('/(main)/mood');
  }, [router]);

  const goToVoice = useCallback(() => {
    router.navigate('/(main)/call');
  }, [router]);

  const goToChat = useCallback(() => {
    router.navigate('/(main)/chat');
  }, [router]);

  const goToJournal = useCallback(() => {
    router.navigate('/(main)/journal');
  }, [router]);

  const goToBreathing = useCallback(() => {
    router.navigate('/(main)/breathing');
  }, [router]);

  const goToProfile = useCallback(() => {
    router.navigate('/(main)/profile');
  }, [router]);

  const lastJournal = stats.lastJournalAgo ?? 'No entries yet';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MelloGradient />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 8,
            paddingBottom: 110 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─── */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(60).easing(ENTER_EASING)}
          style={styles.header}
        >
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>{getGreeting()}</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              Hey {firstName || 'there'} 👋
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={goToProfile}
            hitSlop={8}
          >
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={[...Gradients.melloPrimary] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarEmoji}>{stats.avatarEmoji}</Text>
              </LinearGradient>
              <View style={styles.avatarDot} />
            </View>
          </Pressable>
        </Animated.View>

        {/* ─── Emotional battery ─── */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(180).easing(ENTER_EASING)}
          style={styles.section}
        >
          <EmotionalBatteryBlock
            battery={stats.battery}
            streak={stats.streak}
            journaledToday={stats.journaledToday}
            onCheckInPress={goToMood}
          />
        </Animated.View>

        {/* ─── Quick actions ─── */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(300).easing(ENTER_EASING)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.grid}>
            <QuickActionCard
              tone="voice"
              emoji="🎙️"
              label="Talk to Mello"
              sublabel={`Voice session • ${VOICE_SESSION_BUDGET_MIN} min budget`}
              onPress={goToVoice}
            />
            <QuickActionCard
              tone="chat"
              emoji="💬"
              label="Chat"
              sublabel="Unlimited messages"
              onPress={goToChat}
            />
            <QuickActionCard
              tone="journal"
              emoji="📓"
              label="Journal"
              sublabel={stats.lastJournalAgo ? `Last entry: ${lastJournal}` : 'Write your first entry'}
              onPress={goToJournal}
            />
            <QuickActionCard
              tone="breathe"
              emoji="🌬️"
              label="Breathe"
              sublabel="4-7-8 technique"
              onPress={goToBreathing}
            />
          </View>
        </Animated.View>

        {/* ─── Daily affirmation ─── */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(420).easing(ENTER_EASING)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Daily affirmation</Text>
          <AffirmationCard
            quote={affirmation}
            onRefresh={handleRefreshAffirmation}
            refreshing={refreshingAffirmation}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    gap: Spacing.lg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Spacing.xs,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  eyebrow: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
    color: Colors.light.textMuted,
    marginBottom: 2,
  },
  greeting: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 24,
    lineHeight: 30,
    color: Colors.light.text,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  avatarDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.success,
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },

  // ── Sections ──
  section: {
    gap: Spacing.sm + Spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 13,
    color: Colors.light.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── Quick action grid ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
