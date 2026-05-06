/**
 * Crisis Detection Utility
 * Shared crisis keyword detection for Chat + Voice screens
 */

import { Linking } from 'react-native';

/* Substring keywords. Anything that should match as a literal phrase
 * goes here — kept lowercase, normalised punctuation handled via
 * .toLowerCase() + apostrophe-flattening below. */
export const CRISIS_KEYWORDS = [
  'suicide', 'suicidal',
  'kill myself', 'killing myself',
  'want to die', 'wanna die', 'wanting to die',
  'going to die', 'gonna die',
  'ready to die',
  'end my life', 'ending my life', 'end it all', 'end things',
  'take my life', 'taking my life',
  'harm myself', 'hurt myself', 'cutting', 'self-harm', 'self harm',
  'overdose', 'od myself',
  'feeling hopeless', 'feel hopeless',
  'feeling worthless', 'feel worthless',
  'no reason to live', 'nothing to live for', "don't want to live",
  'want to disappear', 'wanna disappear',
  "can't cope", 'cant cope', 'cannot cope',
  "can't go on", 'cant go on', 'cannot go on',
  'better off dead', 'better off without me',
];

export function detectCrisis(message: string): boolean {
  /* Normalise: lowercase + flatten curly apostrophes/quotes so phrases
   * like "can't" / "can’t" / "cant" all match the same keyword. */
  const lower = message
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"');
  return CRISIS_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Crisis helpline resources — India.
 *
 *  - iCall: free counseling line, 8am–10pm IST. Mentioned in the AI
 *    system prompt so what the user hears in chat matches what they
 *    see here.
 *  - KIRAN: Govt of India 24×7 mental-health support, free, in
 *    multiple Indian languages. Better fallback for late-night calls
 *    when iCall is closed.
 *  - Vandrevala Foundation: 24×7 backup line in case KIRAN is down.
 */
export const CRISIS_RESOURCES = {
  iCall: {
    name: 'iCall',
    number: '9152987821',
    hours: 'free · counseling · 8am–10pm IST',
    url: 'tel:9152987821',
  },
  kiran: {
    name: 'KIRAN — Mental Health Helpline',
    number: '18005990019',
    hours: 'free · 24/7 · govt of india',
    url: 'tel:18005990019',
  },
  vandrevala: {
    name: 'Vandrevala Foundation',
    number: '18602662345',
    hours: 'free · 24/7',
    url: 'tel:18602662345',
  },
};

export function callCrisisLine(): void {
  // Default tap target = iCall. Crisis page surfaces all three.
  Linking.openURL(CRISIS_RESOURCES.iCall.url);
}
