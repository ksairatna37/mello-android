/**
 * composeDeterministicProfile — last-resort fallback tests.
 *
 * When Bedrock fails twice, we synthesize a profile from the user's
 * own answers. These tests pin the *direction* of the result against
 * known answer combinations. Numbers may shift if heuristic offsets
 * are tuned; the assertions here are deliberately structural so
 * minor reweighting won't break them, but a sign-flip will.
 */

import { composeDeterministicProfile } from '@/services/chat/bedrockService';

describe('composeDeterministicProfile', () => {
  test('"Not yet" + low battery + alone → low confidence and positivity', () => {
    const profile = composeDeterministicProfile({
      qHeadWeather: 'stormy',
      qHardestTime: 'late',
      qCopingAnimal: 'shell',
      qStressResponse: 'overwhelmed',
      emotionalBattery: 15,
      qSupportStyle: 'unsure',
      qSadnessResponse: 'immerse',
      emotionalGrowth: 0,
      personalizeTopics: ['anxiety', 'loneliness'],
    });

    // All scores stay inside the safe band [5, 95]
    expect(profile.calm).toBeGreaterThanOrEqual(5);
    expect(profile.confidence).toBeGreaterThanOrEqual(5);
    expect(profile.positivity).toBeGreaterThanOrEqual(5);
    expect(profile.calm).toBeLessThanOrEqual(95);

    // Direction: this is a struggling profile — calm/confidence/positivity
    // should land below the 50 baseline.
    expect(profile.calm).toBeLessThan(50);
    expect(profile.confidence).toBeLessThan(50);
    expect(profile.positivity).toBeLessThan(50);

    // Text fields are populated.
    expect(profile.interpretation.length).toBeGreaterThan(20);
    expect(profile.whatItMeans.length).toBeGreaterThan(20);
  });

  test('"Thriving" + high battery + close circle → calm/confidence above baseline', () => {
    const profile = composeDeterministicProfile({
      qHeadWeather: 'okay',
      qHardestTime: 'sunday',
      qCopingAnimal: 'wolf',
      qStressResponse: 'calm',
      emotionalBattery: 85,
      qSupportStyle: 'listener',
      qSadnessResponse: 'talk',
      emotionalGrowth: 3,
      personalizeTopics: [],
    });

    expect(profile.confidence).toBeGreaterThan(50);
    expect(profile.positivity).toBeGreaterThan(50);
    expect(profile.calm).toBeGreaterThan(50);

    // No score blows past 95 even when every signal is positive.
    expect(profile.calm).toBeLessThanOrEqual(95);
    expect(profile.confidence).toBeLessThanOrEqual(95);
    expect(profile.positivity).toBeLessThanOrEqual(95);
  });
});
