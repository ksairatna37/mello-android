# Mello Phone Agent

**WhatsApp Voice AI** for mental health support using **Pipecat + Hume EVI**.

No Twilio required - direct WhatsApp Cloud API integration.

## Phone Number

**+1 650 643 5030** (WhatsApp)

## Architecture

```
WhatsApp User
     │
     ▼ (WhatsApp Business Calling API)
┌─────────────────┐
│  Meta Cloud API │
│  (SDP/WebRTC)   │
└────────┬────────┘
         │
         ▼ (Webhook)
┌─────────────────┐
│   server.py     │  ← FastAPI + Pipecat WhatsAppClient
│   (Pipecat)     │
└────────┬────────┘
         │
         ▼ (WebRTC Audio)
┌─────────────────┐
│    bot.py       │  ← SmallWebRTCTransport + Hume EVI
│   (Pipeline)    │
└────────┬────────┘
         │
         ▼ (WebSocket)
┌─────────────────┐
│   Hume EVI      │  ← Your config: cc715751-de6e-4d72-ba52-bb29457379fd
│  (Speech-to-    │
│   Speech)       │
└─────────────────┘
```

**Hume EVI handles everything:**
- Speech recognition (transcription)
- LLM processing (your configured model)
- Empathic voice synthesis
- Emotion detection

## Quick Start

### 1. Install Dependencies

```bash
# Using uv (recommended)
uv sync

# Or pip
pip install -e .
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Your `.env`:
```env
# Hume EVI (required)
HUME_API_KEY=your_api_key
HUME_CONFIG_ID=cc715751-de6e-4d72-ba52-bb29457379fd

# WhatsApp Cloud API (required)
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN=mello_phone_agent_2026
```

### 3. Run Server

```bash
python server.py --port 7860
```

### 4. Expose Webhook (Development)

```bash
ngrok http 7860
```

### 5. Configure WhatsApp

1. Go to [Meta Developer Portal](https://developers.facebook.com)
2. Your WhatsApp App → Configuration → Webhooks
3. Set webhook URL: `https://your-ngrok.ngrok.io/webhook`
4. Subscribe to `calls` field
5. Enable voice calling on your phone number

## Project Structure

```
phone-agent/
├── server.py           # FastAPI webhook server (Pipecat WhatsAppClient)
├── bot.py              # Voice bot (SmallWebRTCTransport + Hume EVI)
├── bot_hume_evi.py     # Alternative direct Hume EVI implementation
├── pyproject.toml      # Dependencies
├── .env                # Your credentials
├── .env.example        # Template
└── README.md           # This file
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HUME_API_KEY` | Hume API key | Yes |
| `HUME_CONFIG_ID` | Your EVI configuration | Yes |
| `WHATSAPP_TOKEN` | WhatsApp Business API token | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp number ID | Yes |
| `WHATSAPP_WEBHOOK_VERIFICATION_TOKEN` | Webhook verify token | Yes |

## How It Works

1. **User calls** +1 650 643 5030 on WhatsApp
2. **Meta sends webhook** to your server with SDP offer
3. **Pipecat's WhatsAppClient** handles WebRTC negotiation
4. **SmallWebRTCTransport** captures bidirectional audio
5. **Hume EVI** processes speech → generates empathic response
6. **Audio streams back** to WhatsApp user

## Your Hume EVI Config

- **Config ID**: `cc715751-de6e-4d72-ba52-bb29457379fd`
- **Dashboard**: https://app.hume.ai/evi/configs

The EVI config includes:
- System prompt (personality)
- LLM model (Claude/GPT)
- Voice selection
- Tool definitions (optional)

## Mental Health Features

Built into your Hume EVI config:
- Empathic voice with emotional intelligence
- Warm, trauma-informed responses
- Crisis detection (988 hotline referral)
- Emotion analysis in real-time

## Deployment

### Railway/Render

```bash
# Set environment variables in dashboard
# Deploy from GitHub
```

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -e .
EXPOSE 7860
CMD ["python", "server.py", "--port", "7860"]
```

## References

- [Pipecat WhatsApp Example](https://github.com/pipecat-ai/pipecat-examples/tree/main/whatsapp)
- [Hume EVI Python Quickstart](https://github.com/HumeAI/hume-api-examples/tree/main/evi/evi-python-quickstart)
- [WhatsApp Business Calling API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Pipecat Docs](https://docs.pipecat.ai)
- [Hume EVI Docs](https://dev.hume.ai/docs/speech-to-speech-evi/overview)
