/**
 * validateProfile — mental-health-grade contract tests.
 *
 * The validator gates every reading shown to a user. Each rejection
 * branch here corresponds to a failure mode we'd rather show the
 * soft fallback for than ship a misleading number.
 */

import { validateProfile } from '@/services/chat/bedrockService';

const validScores = {
  calm: 60,
  clarity: 72,
  focus: 45,
  confidence: 55,
  positivity: 68,
};

const validText = {
  interpretation:
    "You're carrying a quiet weight, and the way you named it tells me you already know where to start.",
  whatItMeans:
    'Your Clarity is the strongest dimension right now — you can see the shape of what you are carrying, even when the rest feels heavy.',
};

describe('validateProfile', () => {
  test('rejects when a required score is missing', () => {
    const { calm: _calm, ...missingCalm } = validScores;
    const result = validateProfile({ ...missingCalm, ...validText });
    expect(result).toBeNull();
  });

  test('rejects when scores collapse (range < 5)', () => {
    const result = validateProfile({
      calm: 60, clarity: 61, focus: 62, confidence: 63, positivity: 64,
      ...validText,
    });
    expect(result).toBeNull();
  });

  test('rejects when scores match the prompt example verbatim', () => {
    const result = validateProfile({
      calm: 72, clarity: 55, focus: 64, confidence: 58, positivity: 61,
      ...validText,
    });
    expect(result).toBeNull();
  });

  test('overrides interpretation that lauds a low-scoring dimension', () => {
    // calm = 25 (genuine struggle area), but text calls "your calm" a "foundation"
    const result = validateProfile({
      calm: 25, clarity: 72, focus: 60, confidence: 55, positivity: 50,
      interpretation:
        'Your calm is a steady foundation that everything else can rest on, even on the hard days.',
      whatItMeans: validText.whatItMeans,
    });
    expect(result).not.toBeNull();
    expect(result!.interpretation).not.toMatch(/foundation/i);
  });

  test('overrides whatItMeans that does not reference the actual strongest dimension', () => {
    // strongest = clarity (72), but whatItMeans talks about positivity
    const result = validateProfile({
      ...validScores,
      interpretation: validText.interpretation,
      whatItMeans:
        'Your positivity is what is letting everyone around you lean on you right now — keep leaning on it for yourself too.',
    });
    expect(result).not.toBeNull();
    expect(result!.whatItMeans.toLowerCase()).toContain('clarity');
  });
});
