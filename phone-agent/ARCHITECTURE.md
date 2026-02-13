# Phone Agent Architecture

## Overview

Phone Agent bridges WhatsApp voice calls to Hume.ai's Empathic Voice Interface (EVI), enabling emotionally intelligent voice conversations for Mello's mental health support.

## Call Flow (Pipecat Approach)

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────┐
│  WhatsApp    │────▶│  WhatsApp Cloud  │────▶│    Phone Agent  │────▶│  Hume.ai    │
│  User Call   │     │  API (Webhook)   │     │    (Pipecat)    │     │  EVI        │
└──────────────┘     └──────────────────┘     └─────────────────┘     └─────────────┘
       │                     │                        │                      │
       │  1. User dials      │                        │                      │
       │  +1 650 643 5030    │                        │                      │
       │                     │                        │                      │
       │                     │  2. Webhook POST       │                      │
       │                     │  /whatsapp (SDP offer) │                      │
       │                     │                        │                      │
       │                     │                        │  3. Create WebRTC    │
       │                     │                        │  peer connection     │
       │                     │                        │                      │
       │                     │                        │  4. Connect to Hume  │
       │                     │                        │  WebSocket           │
       │                     │                        │─────────────────────▶│
       │                     │                        │                      │
       │                     │  5. SDP answer         │                      │
       │                     │◀────────────────────────                      │
       │                     │                        │                      │
       │  6. Audio stream    │                        │  7. Audio stream     │
       │◀═══════════════════▶│◀══════════════════════▶│◀════════════════════▶│
       │   (bidirectional)   │                        │   (bidirectional)    │
       │                     │                        │                      │
```

## Components

### 1. WhatsApp Webhook Handler
Receives call events from Meta's Cloud API.

```typescript
// Webhook events
interface WhatsAppCallEvent {
  action: 'connect' | 'terminate';
  call_id: string;
  from: string;
  sdp_offer?: string;
}
```

**Endpoints:**
- `GET /whatsapp` - Webhook verification
- `POST /whatsapp` - Call event handler
- `POST /pre-accept` - Pre-accept call (for SDP exchange)

### 2. WebRTC Bridge
Manages peer connections between WhatsApp and Hume.ai.

```typescript
// Peer connection setup
const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Handle remote audio stream from WhatsApp
peerConnection.ontrack = (event) => {
  const audioStream = event.streams[0];
  forwardToHume(audioStream);
};
```

### 3. Hume.ai EVI Client
WebSocket connection to Hume's EVI for voice processing.

```typescript
// EVI WebSocket connection
const ws = new WebSocket(
  `wss://api.hume.ai/v0/evi/chat?config_id=${CONFIG_ID}&api_key=${API_KEY}`
);

// Send audio input
ws.send(JSON.stringify({
  type: 'audio_input',
  data: base64AudioChunk
}));

// Receive responses
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'audio_output') {
    forwardToWhatsApp(msg.data);
  }
};
```

## Audio Specifications

| Source | Sample Rate | Format | Notes |
|--------|-------------|--------|-------|
| WhatsApp (telephony) | 8,000 Hz | PCM | Compressed for telephony |
| Hume.ai (web) | 24,000 Hz | PCM | Higher quality |
| Hume TTS Output | 48,000 Hz | PCM | Resampled for output |

**Note:** Audio resampling is required between WhatsApp (8kHz) and Hume (24kHz).

## Pipecat Integration

Using Pipecat's `SmallWebRTCTransport` for WhatsApp:

```python
from pipecat.transports.smallwebrtc import SmallWebRTCTransport, TransportParams
from pipecat.services.hume import HumeTTSService

# Transport for WhatsApp
transport = SmallWebRTCTransport(
    webrtc_connection=webrtc_connection,
    params=TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
)

# Hume TTS service
hume_tts = HumeTTSService(
    api_key=os.environ["HUME_API_KEY"],
    voice_id=os.environ["HUME_VOICE_ID"],
)
```

## EVI Configuration for Mental Health

Create a specialized EVI config for Mello's empathic support:

```json
{
  "name": "mello-phone-agent",
  "voice": {
    "provider": "HUME_AI",
    "name": "empathic-companion"
  },
  "language_model": {
    "model_provider": "ANTHROPIC",
    "model_resource": "claude-3-5-sonnet"
  },
  "ellm_model": {
    "allow_short_responses": true
  },
  "system_prompt": "You are Mello, a compassionate mental health companion. Speak with warmth and empathy. Use trauma-informed language. If someone expresses crisis thoughts, provide resources (988 Suicide & Crisis Lifeline)."
}
```

## Security Considerations

1. **Webhook Verification**: Validate Meta's signature on all webhooks
2. **Access Tokens**: Store securely, rotate regularly
3. **HTTPS Only**: All endpoints must use TLS
4. **Rate Limiting**: Implement call rate limits
5. **Crisis Detection**: Route crisis calls to human support

## Error Handling

```typescript
// Graceful degradation
async function handleCall(event: WhatsAppCallEvent) {
  try {
    await connectToHume(event);
  } catch (error) {
    // Fallback: Play pre-recorded message
    await playFallbackMessage(event.call_id,
      "I'm having trouble connecting. Please try again or text us."
    );
    await terminateCall(event.call_id);
    logError(error);
  }
}
```

## Monitoring

- Call duration tracking
- Audio quality metrics
- Hume.ai emotion analysis logs
- Error rate monitoring
- Crisis detection alerts
