# Mello WhatsApp Voice Call Server

Handles WhatsApp voice calls and bridges audio to Hume EVI (Mello's voice).

## Architecture

```
User presses Call in WhatsApp
        ↓
Meta webhook POST → /whatsapp (connect event + SDP offer)
        ↓
call_server.py sends pre_accept → Meta
        ↓
aiortc creates WebRTC peer connection + SDP answer
        ↓
call_server.py sends accept + SDP answer → Meta
        ↓
Two-way audio: WhatsApp ↔ call_server.py ↔ Hume EVI WebSocket
        ↓
Hume EVI (Mello persona) speaks to the WhatsApp user
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

On Windows, aiortc needs additional system deps:
```bash
pip install aiortc aiohttp
```

### 2. Configure .env

```bash
cp .env.example .env
# Fill in your values
```

You need one extra value: **WHATSAPP_APP_SECRET**
- Go to Meta Developer Console → your app → App Settings → Basic
- Click "Show" next to App Secret → copy it → paste in .env

### 3. Run both servers

Terminal 1 — Text chat (existing):
```bash
cd your-text-agent-folder
python server.py        # runs on port 8000
```

Terminal 2 — Voice calls (new):
```bash
cd mello-voice-call
python call_server.py   # runs on port 8001
```

Terminal 3 — ngrok (tunnel both ports):
```bash
# Text webhook:  https://YOUR_DOMAIN/webhook  → port 8000
# Call webhook:  https://YOUR_DOMAIN/whatsapp → port 8001
ngrok http 8001
```

### 4. Update Meta webhook for calls

In Meta Developer Console:
- WhatsApp → Configuration → Webhooks
- Set Callback URL to: `https://YOUR_NGROK_URL/whatsapp`
- Verify Token: `mello_verify_123`
- Make sure `calls` webhook field is subscribed ✓

> Your existing text webhook stays at port 8000 unchanged.
> The call webhook is on port 8001 at path /whatsapp.

### 5. Test

1. Open WhatsApp on your phone
2. Go to the Mello business number chat
3. Press the call button (phone icon)
4. You should hear Mello answer!

## Troubleshooting

**Call still drops instantly**
- Check your /whatsapp path is returning 200 to Meta's webhook verification
- Check logs for any error in handle_incoming_call()

**Audio connected but silence**
- Check Hume API key and Config ID in .env
- View logs for "Connected to Hume EVI ✓"

**SDP negotiation error**
- WhatsApp only supports SHA-256 fingerprints — already handled by filter_sdp_fingerprints()
- Check aiortc is installed: `pip install aiortc`

## How it works

1. **pre_accept** — tells Meta you're aware of the call (must be sent within ~2 seconds)
2. **WebRTC SDP negotiation** — aiortc acts as the WebRTC peer, accepts Meta's offer, creates answer
3. **Hume EVI bridge** — audio from WhatsApp user streams to Hume EVI WebSocket; Hume's response audio streams back to the user
4. **HumeAudioTrack** — a virtual aiortc AudioStreamTrack that feeds Hume's audio output into the WebRTC connection
