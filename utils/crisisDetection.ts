/**
 * Crisis Detection Utility
 * Shared crisis keyword detection for Chat + Voice screens
 */

import { Linking } from 'react-native';

export const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'want to die', 'end my life',
  'harm myself', 'cutting', 'self-harm', 'overdose',
  'feeling hopeless', 'feeling worthless', 'no reason to live',
  'want to disappear', "can't cope",
];

export function detectCrisis(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}

export const CRISIS_RESOURCES = {
  lifeline: {
    name: 'National Suicide Prevention Lifeline',
    number: '988',
    url: 'tel:988',
  },
  textLine: {
    name: 'Crisis Text Line',
    number: '741741',
    body: 'HOME',
    url: 'sms:741741?body=HOME',
  },
};

export function callCrisisLine(): void {
  Linking.openURL(CRISIS_RESOURCES.lifeline.url);
}

export function textCrisisLine(): void {
  Linking.openURL(CRISIS_RESOURCES.textLine.url);
}
