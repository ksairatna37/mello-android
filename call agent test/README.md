# Hume EVI Voice Test

End-to-end test setup for Hume EVI before connecting to WhatsApp Business Calling API.

## Setup

### 1. Get your Hume API Key
Go to → https://app.hume.ai/keys → copy your API key

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

On Linux, also install system audio deps:
```bash
sudo apt-get install libasound2-dev libportaudio2
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env and paste your HUME_API_KEY
```

---

## Option A — Browser Test (Recommended)

Starts a local server with a visual call UI in your browser.

```bash
python server.py
```

Open → http://localhost:8000

- Enter your API key (pre-filled from .env)
- Click **Connect & Start**
- Speak — EVI responds in real time
- Transcript + detected emotions shown live

---

## Option B — CLI Test (Terminal only)

Faster, no browser needed.

```bash
python cli_test.py
```

Speak into your mic. EVI responds through your speakers.
Press `Ctrl+C` to end.

---

## What This Tests

| Layer | Status |
|---|---|
| Microphone capture | ✅ Tested here |
| Audio streaming to EVI | ✅ Tested here |
| EVI speech-to-speech | ✅ Tested here |
| Emotion detection | ✅ Shown in transcript |
| Audio playback | ✅ Tested here |
| WhatsApp delivery | ⏳ After Meta verification |

Once Meta business verification is done and Calling API is enabled, the audio
bridge from WhatsApp → your server → Hume EVI WebSocket replaces the browser
mic input — the Hume EVI part stays exactly the same.
