/**
 * Sound Spaces — catalog + types.
 *
 * Source of truth: `mobile-screens-spaces.jsx` in the Claude design folder.
 * Each space carries a {warm, cool, deep} color triad pulled from BRAND
 * tokens so the artwork composes itself; no hand-picked per-pixel values.
 *
 * `moodPair` keys link each space to a mood from `mobile-mood.jsx` so the
 * engine can suggest a space that meets the user where they are.
 */

import { BRAND as C } from '@/components/common/BrandGlyphs';

/* Arcs are the inner-weather shape of the room — what changes between
 * stepping in and stepping out. Therapist-validated v1 set; do not add
 * an arc without a clinical rationale (CBT / DBT / ACT / polyvagal). */
export type SpaceArc =
  | 'settling'      // hyperarousal → ventral-vagal safety
  | 'warming'       // dorsal-vagal shutdown → re-entry to body
  | 'unspooling'    // anxious rumination → cognitive defusion
  | 'spacious'      // sadness → allowing
  | 'discharging'   // activated → contained release
  | 'lifting';      // flat → re-engagement (Snyder hope theory)

/* Mood-pairs are the user's likely state on entry — non-clinical labels
 * a non-therapist user would self-identify with. NOT diagnostic. */
export type SpaceMood =
  | 'overwhelmed'
  | 'numb'
  | 'anxious'
  | 'sad'
  | 'activated'
  | 'flat';

export interface SpacePalette {
  warm: string;
  cool: string;
  deep: string;
}

export interface SoundSpace {
  id: string;
  title: string;
  /** Italic poetic line shown under the title — design has curly apostrophe */
  line: string;
  minutes: number;
  bed: string;
  arc: SpaceArc;
  moodPair: SpaceMood;
  palette: SpacePalette;
}

/* Therapist-validated 7-room MVP catalog (clean-slate design, 2026-05).
 * Each `bed` line is the acoustic brief a sound designer / mastering
 * engineer can source from. Each entry has a clinical rationale stored
 * in code review notes — see therapist's Phase 1 review for the
 * framework citations. */
export const SOUND_SPACES: ReadonlyArray<SoundSpace> = [
  {
    // hyperarousal → ventral-vagal safety. Polyvagal: low-frequency,
    // predictable, slow-tempo input cues safety; absent treble removes
    // startle bandwidth.
    id: 'still-water',
    title: 'Still Water',
    line: 'the surface is loud. the deep is quiet.',
    minutes: 8,
    bed: 'low sub-bass drone (60–80 Hz), slow felt-piano pulses ~50 BPM, faint underwater shimmer 200–400 Hz, no frequencies above 4 kHz',
    arc: 'settling',
    moodPair: 'overwhelmed',
    palette: { warm: C.lavender, cool: C.sage, deep: C.ink },
  },
  {
    // dorsal-vagal shutdown → gentle re-entry to body. Warm mid-band
    // textures + slow heart-rate-adjacent pulse invite interoception.
    id: 'ember',
    title: 'Ember',
    line: 'a small warmth, kept alive by nothing.',
    minutes: 12,
    bed: 'warm tape-saturated cello held tones, slow analog hiss, distant low-tom heartbeat ~60 BPM, gentle 250 Hz body resonance',
    arc: 'warming',
    moodPair: 'numb',
    palette: { warm: C.coral, cool: C.peach, deep: C.clay },
  },
  {
    // ACT cognitive defusion. Removal of rhythmic structure and
    // goal-shaped sound disrupts rumination loops; non-pulsed field
    // reduces task-orientation.
    id: 'weightless',
    title: 'Weightless',
    line: 'nothing here needs you to do anything.',
    minutes: 15,
    bed: 'sustained airy strings (high cellos + violas), wide reverb tail, granular wind texture, no rhythmic pulse, slow Shepard-tone-like descents every 40–90 s',
    arc: 'unspooling',
    moodPair: 'anxious',
    palette: { warm: C.peach, cool: C.lavender, deep: C.ink },
  },
  {
    // Self-Compassion (Neff) / RAIN (Brach). A container that doesn't
    // try to fix mood lets the user practice allowing rather than
    // suppressing; reduces secondary shame loop.
    id: 'field-at-dusk',
    title: 'Field at Dusk',
    line: 'sadness is allowed to take up the whole room.',
    minutes: 20,
    bed: 'distant pedal-steel-like swells, filtered cricket bed (no sharp transients), low wooden creaks, soft 100 Hz floor',
    arc: 'spacious',
    moodPair: 'sad',
    palette: { warm: C.coral, cool: C.lavender, deep: C.lavenderDeep },
  },
  {
    // Polyvagal + sensory grounding. Enclosing broadband noise masks
    // intrusive auditory salience; bass rumble grounds activated
    // states (anger, panic) without inviting catharsis.
    id: 'storm-shelter',
    title: 'Storm Shelter',
    line: "the storm is outside. you don’t have to fight it.",
    minutes: 10,
    bed: 'thick rain-on-roof (mid-band, no thunder), 40–60 Hz low rumble, faint metal-ping resonance at long intervals, woolen muffled feel',
    arc: 'discharging',
    moodPair: 'activated',
    palette: { warm: C.lavender, cool: C.sage, deep: C.lavenderDeep },
  },
  {
    // Hope theory (Snyder) — pathways component. Gentle ascending
    // harmonic motion suggests possibility without prescribing action;
    // the catalog's only non-saccharine "lift" room so flat /
    // anhedonic users have somewhere that isn't asking them to sit
    // with weight.
    id: 'morning-light',
    title: 'Morning Light',
    line: 'a small opening, no hurry to walk through it.',
    minutes: 6,
    bed: 'sparse glassy bell tones (Rhodes-like), upper-mid air at 2–4 kHz, slow rising harmonic series every 30 s, no percussion',
    arc: 'lifting',
    moodPair: 'flat',
    palette: { warm: C.butter, cool: C.peach, deep: C.ink },
  },
];

export const SPACES_BY_ID: ReadonlyMap<string, SoundSpace> = new Map(
  SOUND_SPACES.map((s) => [s.id, s]),
);

/** Featured space for the home-screen entry tile. `weightless` chosen
 *  as the most universal entry invitation — its line ("nothing here
 *  needs you to do anything") fits a user who taps the home card
 *  without yet knowing what they need, and its ACT-cognitive-defusion
 *  mechanism is the broadest match for the contemplative-app open
 *  intent ("I'm anxious, I'm overthinking, give me a place"). */
export const FEATURED_SPACE_ID = 'weightless';

/* ─── Library sections — catalog grouping for the index screen ────── */

export type SectionGlyph = 'Sparkle' | 'Wave' | 'Leaf' | 'Moon';

export interface SpaceSection {
  id: string;
  title: string;
  glyph: SectionGlyph;
  spaceIds: ReadonlyArray<string>;
}

/** Curated set of soft, contemplative one-word labels in the SelfMind
 *  voice. Used by the sitting screen as the centered timeline label
 *  (replaces a static "drifting"). All lowercase, no clinical terms,
 *  no emoji, present-tense gerunds and short noun phrases — see
 *  `rules/page-design.md` §1 ("notice / tend / sit with" preferred).
 *  Add to this list, don't shorten — variety is the point. */
export const SPACE_TIMELINE_LABELS: ReadonlyArray<string> = [
  'drifting',
  'softening',
  'settling',
  'unwinding',
  'arriving',
  'tending',
  'noticing',
  'resting',
  'lingering',
  'listening',
  'breathing',
  'being held',
  'letting go',
  'just here',
  'almost rested',
  'exhaling',
  'quieting',
  'slowing',
  'coming home',
  'sitting with',
];

/** Stable per-id pick — same space always renders the same label
 *  within a process lifetime (predictable for the user; not whiplashy
 *  on every render). Different spaces get different labels so the
 *  catalog feels varied. Uses a small string-hash so the pick is
 *  deterministic without holding state. */
export function pickTimelineLabel(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % SPACE_TIMELINE_LABELS.length;
  return SPACE_TIMELINE_LABELS[idx];
}

/** Three sections grouped by autonomic state, NOT time of day.
 *  Therapist clinical recommendation: time-of-day sections quietly
 *  prescribe ("it's 2pm, you should be in a lifting room") whereas
 *  distress is acyclic — anxiety at 3am, heaviness at 11am. Mapping by
 *  inner-state lets the user self-select on what they feel, not on
 *  the clock.
 *
 *    when it's too much  → hyperarousal (overwhelm, anxiety, anger)
 *    when it's heavy     → hypoarousal / disconnection (sad, numb, alone)
 *    when something opens → recovery / re-engagement (flat → lifting)
 */
export const SPACE_SECTIONS: ReadonlyArray<SpaceSection> = [
  {
    id: 'spinning',
    title: "when you're spinning",
    glyph: 'Wave',
    spaceIds: ['still-water', 'storm-shelter', 'weightless'],
  },
  {
    id: 'weighed-down',
    title: "when you're weighed down",
    glyph: 'Moon',
    spaceIds: ['field-at-dusk', 'ember'],
  },
  {
    id: 'opens',
    title: 'when something opens',
    glyph: 'Sparkle',
    spaceIds: ['morning-light'],
  },
];
