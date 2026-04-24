/**
 * useHomeStats — drives the Home dashboard's live data.
 *
 * Stale-while-revalidate: returns the previous stats immediately on re-focus,
 * then refreshes in the background. Re-fetches when the screen regains focus
 * so new mood check-ins / journal entries reflect right away.
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/services/auth';
import { loadHomeStats, type HomeStats } from '@/services/home/homeStatsService';

const EMPTY_STATS: HomeStats = {
  battery: null,
  streak: 0,
  journaledToday: false,
  lastJournalAgo: null,
  avatarEmoji: '💜',
};

export function useHomeStats() {
  const { user, emailUser } = useAuth();
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const userId = user?.id ?? emailUser?.userId ?? null;
      const accessToken = userId ? await getAccessToken() : null;
      const next = await loadHomeStats({ userId, accessToken });
      setStats(next);
    } catch (err) {
      console.warn('[useHomeStats] refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, emailUser?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { stats, loading, refresh };
}
