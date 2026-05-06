import type { NotificationKind } from '@/services/notifications/notificationService';

export interface NotificationCopyContext {
  unread: number;
  total: number;
  loading?: boolean;
  kinds?: NotificationKind[];
  now?: Date;
}

export interface NotificationCopy {
  kicker: string;
  headline: string;
  emphasis: string;
}

type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'late';

export function getNotificationCopy({
  unread,
  total,
  loading = false,
  kinds = [],
  now = new Date(),
}: NotificationCopyContext): NotificationCopy {
  if (loading) {
    return {
      kicker: 'CHECKING SOFTLY',
      headline: 'Looking for little things',
      emphasis: 'worth catching',
    };
  }

  if (total === 0) {
    return quietCopy(getTimeBucket(now));
  }

  if (unread > 0) {
    return unreadCopy(unread, dominantKind(kinds), getTimeBucket(now));
  }

  return {
    kicker: 'READ, BUT HERE',
    headline: 'Nothing new',
    emphasis: 'needs you',
  };
}

function quietCopy(time: TimeBucket): NotificationCopy {
  switch (time) {
    case 'morning':
      return { kicker: 'QUIET MORNING', headline: 'Nothing pressing', emphasis: 'right now' };
    case 'afternoon':
      return { kicker: 'QUIET, ON PURPOSE', headline: 'Nothing pressing', emphasis: 'right now' };
    case 'evening':
      return { kicker: 'SOFT EVENING', headline: 'Nothing asking for', emphasis: 'attention' };
    case 'late':
    default:
      return { kicker: 'LOW LIGHTS', headline: 'Nothing loud', emphasis: 'tonight' };
  }
}

function unreadCopy(unread: number, kind: NotificationKind | null, time: TimeBucket): NotificationCopy {
  const kicker = `${unread} SOFT NUDGE${unread === 1 ? '' : 'S'}`;

  switch (kind) {
    case 'practice_nudge':
      return { kicker, headline: 'A tiny practice is', emphasis: 'waiting' };
    case 'sound_space':
      return { kicker, headline: 'A sound space is', emphasis: time === 'late' ? 'nearby' : 'open' };
    case 'journal_prompt':
      return { kicker, headline: 'A thought might be', emphasis: 'worth catching' };
    case 'weekly_reflection':
    case 'mood_pattern':
      return { kicker, headline: 'A small pattern is', emphasis: 'showing' };
    case 'voice_followup':
      return { kicker, headline: 'Something from voice is', emphasis: 'saved' };
    case 'daily_checkin':
      return { kicker, headline: 'A tiny check-in is', emphasis: 'waiting' };
    default:
      return { kicker, headline: 'Little things worth', emphasis: 'catching' };
  }
}

function dominantKind(kinds: NotificationKind[]): NotificationKind | null {
  if (kinds.length === 0) return null;
  const counts = new Map<NotificationKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function getTimeBucket(date: Date): TimeBucket {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late';
}
