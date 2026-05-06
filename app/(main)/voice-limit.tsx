/**
 * Voice Limit route — soft paywall.
 *
 * Reached via `router.push('/voice-limit')` when the free-session
 * counter exceeds the weekly limit. Hidden from tab bar.
 */

import SelfMindVoiceLimit from '@/components/voice/SelfMindVoiceLimit';
export default SelfMindVoiceLimit;
