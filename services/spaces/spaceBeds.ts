/**
 * Sound Spaces — audio bed catalog.
 *
 * Maps each `SoundSpace.id` to a remote audio URL. Beds are streamed
 * from a CDN, NOT bundled into the IPA/APK (8 × ~15 MB MP3 ≈ 120 MB
 * is too big to ship inside the binary). expo-audio caches the file
 * locally after first play.
 *
 * Source plan (per audio research, 2026-05-04):
 * - Primary: Pixabay Sounds — free, commercial in-app use, no
 *   attribution required. https://pixabay.com/service/license-summary/
 * - Fallback: Freesound CC0-only entries for the more specific field
 *   recordings (creak + root tone, footsteps + city).
 * - Rejected: YouTube Audio Library (license scoped to YouTube only),
 *   Epidemic / Artlist standard plans (don't cover redistribution as
 *   app content), CC-BY / CC-BY-NC tracks (attribution / paid-app
 *   conflicts).
 *
 * Each entry below carries:
 *   - `url`: the streamable MP3 (CDN-hosted; placeholder until tracks
 *     are picked + uploaded). When `null`, the bed is treated as
 *     silent — the sitting screen plays no audio but the timer still
 *     ticks. This lets us ship the visual feature ahead of the audio
 *     curation.
 *   - `durationSec` / `durationLabel`: measured once when the shipped
 *     MP3 is curated. Catalog cards read this static metadata directly
 *     instead of loading/probing many remote tracks at render time.
 *   - `attribution`: "" by default (Pixabay license requires none).
 *     Populate only when a non-Pixabay source is used so the in-app
 *     credits surface stays honest.
 */

export interface SpaceBed {
  /** Streamable MP3 URL. `null` → silent bed (visual-only session). */
  url: string | null;
  /** Actual MP3 duration in seconds, measured from the shipped track. */
  durationSec?: number;
  /** Preformatted duration for fast card rendering. */
  durationLabel?: string;
  /** Optional human-readable credit. Empty for Pixabay. */
  attribution: string;
}

/** Therapist-validated 7-room MVP. Bed URLs await sound-designer
 *  Phase 2 — for each room the engineer will pick a Pixabay (or
 *  Freesound CC0) candidate, the team uploads the MP3 to Supabase
 *  Storage `sound-spaces/<id>.mp3`, and the public URL replaces the
 *  `null` here. Until then, each room renders the visual session +
 *  timer with the "sound for this room is coming" hairline indicator.
 *
 *  The bed acoustic briefs live alongside each room in
 *  `services/spaces/spaces.ts` (in the `bed` field). Reproduced here
 *  in shorter form so this file is self-contained for curation. */
export const SPACE_BEDS: Record<string, SpaceBed> = {
  //  8 min · settling · sub-bass drone, slow felt-piano, no treble
  // SHIPS — Drone Meditation Landscape (clinically degraded — Pixabay
  // HPFs the sub-100 Hz autonomic-floor mechanism away; product call
  // accepted the trade vs shipping silent).
  // https://pixabay.com/music/ambient-drone-meditation-landscape-atmospheric-timelapse-ambient-music-16408/
  'still-water':   {
    url: 'https://qoxtkiainkokmlyakwgu.supabase.co/storage/v1/object/public/sound_spaces/still-water.mp3',
    durationSec: 816,
    durationLabel: '13:36',
    attribution: '',
  },

  // 12 min · warming · cello held tones, slow heartbeat ~60 BPM
  // SHIPS — Mindfulness Relaxation & Meditation (clinically degraded —
  // no clinical-tempo heartbeat-entrainment layer; cello-warmth alone
  // is a different intervention per therapist; product call accepted).
  // https://pixabay.com/music/ambient-mindfulness-relaxation-amp-meditation-music-22174/
  'ember':         {
    url: 'https://qoxtkiainkokmlyakwgu.supabase.co/storage/v1/object/public/sound_spaces/ember.mp3',
    durationSec: 500,
    durationLabel: '08:20',
    attribution: '',
  },

  // 15 min · unspooling · sustained airy strings, wide reverb, no pulse
  // SHIPS — Celestial Drift – Space Ambient Meditation
  // https://pixabay.com/music/ambient-celestial-drift-space-ambient-meditation-403503/
  'weightless':    {
    url: 'https://qoxtkiainkokmlyakwgu.supabase.co/storage/v1/object/public/sound_spaces/weightless.mp3',
    durationSec: 260,
    durationLabel: '04:20',
    attribution: '',
  },

  // 20 min · spacious · pedal-steel swells + cricket bed
  // SHIPS — Night Crickets Ambience on Rural Property (clinically
  // degraded — no pedal-steel layer; the room becomes "evening field"
  // rather than "field with human-bend in pitch", losing the
  // pitch-bend co-regulation mechanism per therapist; product call
  // accepted the trade).
  // https://pixabay.com/sound-effects/night-crickets-ambience-on-rural-property-22527/
  'field-at-dusk': {
    url: 'https://qoxtkiainkokmlyakwgu.supabase.co/storage/v1/object/public/sound_spaces/field-at-dusk.mp3',
    durationSec: 581,
    durationLabel: '09:41',
    attribution: '',
  },

  // 10 min · discharging · thick rain-on-roof, no thunder
  // SHIPS — Light Rain on Metal Roof (9:00)
  // https://pixabay.com/sound-effects/nature-light-rain-on-metal-roof-114527/
  'storm-shelter': {
    url: 'https://qoxtkiainkokmlyakwgu.supabase.co/storage/v1/object/public/sound_spaces/storm-shelter.mp3',
    durationSec: 540,
    durationLabel: '09:00',
    attribution: '',
  },

  //  6 min · lifting · real birds, no music bed
  // SHIPS — Bird Song Dawn Chorus
  // https://pixabay.com/sound-effects/bird-song-dawn-chorus-53470/
  'morning-light': {
    url: 'https://qoxtkiainkokmlyakwgu.supabase.co/storage/v1/object/public/sound_spaces/morning-light.mp3',
    durationSec: 650,
    durationLabel: '10:50',
    attribution: '',
  },
};

/** Resolves the bed for a space. Always returns an object — `url:null`
 *  means silent, never throws. */
export function getSpaceBed(id: string): SpaceBed {
  return SPACE_BEDS[id] ?? { url: null, attribution: '' };
}

export function getSpaceDurationLabel(id: string): string {
  const bed = getSpaceBed(id);
  if (bed.durationLabel) return bed.durationLabel;
  if (typeof bed.durationSec === 'number' && Number.isFinite(bed.durationSec) && bed.durationSec > 0) {
    return formatDurationLabel(bed.durationSec);
  }
  return '--:--';
}

function formatDurationLabel(durationSec: number): string {
  const total = Math.floor(durationSec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
