/**
 * Mood-driven avatar emoji for the Home header.
 * Maps the user's latest mood check-in → a warm emoji that mirrors how they
 * said they were feeling. Falls back to the Self Mind 💜 mark when no mood
 * has been recorded yet, keeping the brand tone optimistic.
 */

const MOOD_TO_EMOJI: Record<string, string> = {
  great: '😄',
  good: '😊',
  okay: '🙂',
  low: '🌤️',
  rough: '🫂',
};

export function getAvatarEmojiForMood(moodId: string | null | undefined): string {
  if (!moodId) return '💜';
  return MOOD_TO_EMOJI[moodId] ?? '💜';
}
