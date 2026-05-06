/**
 * Voice Summary route — post-call surface.
 *
 * Reached via `router.replace('/voice-summary?id=<sessionId>')` from
 * VoiceAgentScreen once the call has finalized. Hidden from tab bar.
 */

import SelfMindVoiceSummary from '@/components/voice/SelfMindVoiceSummary';
export default SelfMindVoiceSummary;
