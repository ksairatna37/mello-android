/* Old character set (joy / anxiety / distracted / surprised / sad / calm)
 * — used by MoodTrackerScreen. Deprecation candidate; left in place
 * until the tracker screen is migrated or removed. */
export { MoodCharacter, type MoodType } from './MoodCharacter';
export { MoodTrackerScreen } from './MoodTrackerScreen';

/* Five-label mood creature set (not good / meh / OK / good / amazing)
 * — used by SelfMindHome's check-in flow and (M2) the SelfMindProgress
 * 14-day grid. */
export { default as MoodDot, MOOD_KEYS, MOOD_PALETTE, type MoodId } from './MoodDot';
export { default as MoodPicker } from './MoodPicker';
export { default as MoodSelectedCard } from './MoodSelectedCard';
export { default as MoodGrid14Days } from './MoodGrid14Days';
