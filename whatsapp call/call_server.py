"""
Mello WhatsApp Voice Call Handler
----------------------------------
Architecture:
  User presses Call in WhatsApp
    → Meta sends webhook POST (connect event + SDP offer) to /whatsapp
    → This server sends pre_accept → Meta
    → aiortc creates WebRTC peer connection, generates SDP answer
    → This server sends accept + SDP answer → Meta
    → Audio flows: WhatsApp ↔ this server ↔ Hume EVI WebSocket
    → Hume EVI (Mello persona) speaks back to the WhatsApp user

Run alongside your existing text server.py (different port):
  python call_server.py   → runs on port 8001
  python server.py        → runs on port 8000 (text chat)

Webhook URL for calls: https://YOUR_NGROK/whatsapp
(separate from text webhook at /webhook)
"""

import os
import asyncio
import json
import logging
import hmac
import hashlib
from datetime import datetime

import httpx
import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse

# aiortc for WebRTC
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────
WHATSAPP_TOKEN            = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_ID         = os.getenv("WHATSAPP_PHONE_ID")
WHATSAPP_APP_SECRET       = os.getenv("WHATSAPP_APP_SECRET", "")
WEBHOOK_VERIFY_TOKEN      = os.getenv("WEBHOOK_VERIFY_TOKEN", "mello_verify_123")

HUME_API_KEY    = os.getenv("HUME_API_KEY")
HUME_CONFIG_ID  = os.getenv("HUME_CONFIG_ID", "")

WHATSAPP_API_BASE = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}"

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("mello-calls")

# ── FastAPI app ───────────────────────────────────────────────────────────
app = FastAPI(title="Mello WhatsApp Voice Call Handler")

# Active calls: call_id → { "pc": RTCPeerConnection, "hume_ws": ws, "phone": str }
active_calls: dict[str, dict] = {}


# ── WhatsApp API helpers ───────────────────────────────────────────────────
async def wa_post(path: str, payload: dict) -> dict:
    """POST to WhatsApp Cloud API."""
    url = f"https://graph.facebook.com/v19.0/{path}"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
        if resp.status_code not in (200, 201):
            log.error(f"WA API error {resp.status_code}: {resp.text}")
        return resp.json()


async def pre_accept_call(call_id: str):
    """Tell Meta we're about to accept the call (required before sending SDP answer)."""
    log.info(f"[{call_id}] Sending pre_accept")
    result = await wa_post(
        f"phone_numbers/{WHATSAPP_PHONE_ID}/calls",
        {
            "call_id": call_id,
            "action": "pre_accept",
        }
    )
    log.info(f"[{call_id}] pre_accept response: {result}")
    return result


async def accept_call(call_id: str, sdp_answer: str):
    """Send our SDP answer to Meta to establish the WebRTC connection."""
    log.info(f"[{call_id}] Sending accept with SDP answer")
    result = await wa_post(
        f"phone_numbers/{WHATSAPP_PHONE_ID}/calls",
        {
            "call_id": call_id,
            "action": "accept",
            "session": {
                "sdp": sdp_answer,
                "sdp_type": "answer",
            }
        }
    )
    log.info(f"[{call_id}] accept response: {result}")
    return result


async def terminate_call(call_id: str):
    """Hang up a call."""
    log.info(f"[{call_id}] Terminating call")
    await wa_post(
        f"phone_numbers/{WHATSAPP_PHONE_ID}/calls",
        {
            "call_id": call_id,
            "action": "terminate",
        }
    )


# ── Hume EVI WebSocket ────────────────────────────────────────────────────
async def connect_hume_evi(call_id: str, audio_track) -> aiohttp.ClientWebSocketResponse:
    """
    Connect to Hume EVI WebSocket and set up bidirectional audio bridging.
    audio_track: the aiortc AudioStreamTrack from the WhatsApp caller.
    Returns the Hume WebSocket connection.
    """
    config_param = f"&config_id={HUME_CONFIG_ID}" if HUME_CONFIG_ID else ""
    hume_url = f"wss://api.hume.ai/v0/evi/chat?api_key={HUME_API_KEY}{config_param}"

    log.info(f"[{call_id}] Connecting to Hume EVI...")

    session = aiohttp.ClientSession()
    ws = await session.ws_connect(hume_url)

    log.info(f"[{call_id}] Connected to Hume EVI ✓")

    # Start bidirectional audio bridge in background
    asyncio.create_task(bridge_audio(call_id, audio_track, ws))

    return ws, session


async def bridge_audio(call_id: str, audio_track, hume_ws):
    """
    Bridge audio between WhatsApp WebRTC track and Hume EVI WebSocket.
    - Reads audio frames from WhatsApp user
    - Sends them to Hume EVI as base64 audio
    - Receives Hume EVI audio responses
    - Plays them back via the WebRTC peer connection
    """
    import base64
    import numpy as np

    log.info(f"[{call_id}] Audio bridge started")

    async def send_user_audio():
        """Read from WhatsApp audio track → send to Hume EVI."""
        try:
            while True:
                frame = await audio_track.recv()
                # Convert audio frame to bytes
                audio_bytes = bytes(frame.planes[0])
                # Encode as base64 and send to Hume
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                await hume_ws.send_str(json.dumps({
                    "type": "audio_input",
                    "data": audio_b64,
                }))
        except Exception as e:
            log.error(f"[{call_id}] Error sending user audio: {e}")

    async def receive_hume_audio():
        """Receive from Hume EVI → queue for sending back to WhatsApp user."""
        try:
            async for msg in hume_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    msg_type = data.get("type", "")

                    if msg_type == "audio_output":
                        # Hume is speaking — audio goes back to WhatsApp user
                        # This is handled by the VirtualAudioTrack below
                        audio_data = data.get("data", "")
                        if audio_data and call_id in active_calls:
                            call = active_calls[call_id]
                            if "audio_sink" in call:
                                import base64
                                audio_bytes = base64.b64decode(audio_data)
                                await call["audio_sink"].put(audio_bytes)

                    elif msg_type == "user_message":
                        transcript = data.get("message", {}).get("content", "")
                        log.info(f"[{call_id}] User said: {transcript}")

                    elif msg_type == "assistant_message":
                        transcript = data.get("message", {}).get("content", "")
                        log.info(f"[{call_id}] Mello said: {transcript}")

                    elif msg_type == "error":
                        log.error(f"[{call_id}] Hume error: {data}")

        except Exception as e:
            log.error(f"[{call_id}] Error receiving Hume audio: {e}")

    # Run both directions concurrently
    await asyncio.gather(
        send_user_audio(),
        receive_hume_audio(),
        return_exceptions=True,
    )
    log.info(f"[{call_id}] Audio bridge ended")


# ── Virtual Audio Track (Hume → WhatsApp) ─────────────────────────────────
class HumeAudioTrack(MediaStreamTrack):
    """
    A virtual audio track that feeds Hume EVI's audio output
    back to the WhatsApp user via WebRTC.
    """
    kind = "audio"

    def __init__(self, call_id: str):
        super().__init__()
        self.call_id = call_id
        self._queue = asyncio.Queue()
        self._timestamp = 0

    async def put(self, audio_bytes: bytes):
        await self._queue.put(audio_bytes)

    async def recv(self):
        from aiortc.mediastreams import AudioFrame
        import av

        # Wait for audio from Hume EVI
        try:
            audio_bytes = await asyncio.wait_for(self._queue.get(), timeout=0.02)
        except asyncio.TimeoutError:
            # Send silence while waiting
            audio_bytes = bytes(640)  # 20ms of silence at 16kHz mono

        # Package as AudioFrame
        frame = av.AudioFrame(format='s16', layout='mono', samples=len(audio_bytes) // 2)
        frame.planes[0].update(audio_bytes)
        frame.sample_rate = 16000
        frame.pts = self._timestamp
        frame.time_base = "1/16000"
        self._timestamp += frame.samples
        return frame


# ── Handle incoming WhatsApp call ──────────────────────────────────────────
async def handle_incoming_call(call_id: str, from_phone: str, sdp_offer: str):
    """
    Full call handling flow:
    1. Send pre_accept to Meta
    2. Create WebRTC peer connection
    3. Set remote description (SDP offer from Meta)
    4. Connect to Hume EVI
    5. Create answer SDP
    6. Send accept + SDP answer to Meta
    """
    log.info(f"[{call_id}] Incoming call from {from_phone}")

    # Step 1: pre_accept immediately
    await pre_accept_call(call_id)

    # Step 2: Create WebRTC peer connection
    pc = RTCPeerConnection()

    # Hume audio output track (plays Mello's voice to user)
    hume_audio_out = HumeAudioTrack(call_id)
    pc.addTrack(hume_audio_out)

    # Store call state
    active_calls[call_id] = {
        "pc": pc,
        "phone": from_phone,
        "audio_sink": asyncio.Queue(),
        "started_at": datetime.utcnow().isoformat(),
    }

    # Track for receiving user's audio from WhatsApp
    user_audio_track = None

    @pc.on("track")
    def on_track(track):
        nonlocal user_audio_track
        log.info(f"[{call_id}] Received {track.kind} track from WhatsApp")
        if track.kind == "audio":
            user_audio_track = track

    @pc.on("connectionstatechange")
    async def on_connection_state():
        log.info(f"[{call_id}] WebRTC state: {pc.connectionState}")
        if pc.connectionState in ("failed", "closed", "disconnected"):
            await cleanup_call(call_id)

    # Step 3: Set remote description (SDP offer from Meta/WhatsApp)
    # WhatsApp only supports SHA-256 fingerprints — filter others
    filtered_sdp = filter_sdp_fingerprints(sdp_offer)
    await pc.setRemoteDescription(RTCSessionDescription(sdp=filtered_sdp, type="offer"))

    # Step 4: Wait briefly for track to arrive, then connect Hume
    await asyncio.sleep(0.5)

    if user_audio_track:
        hume_ws, hume_session = await connect_hume_evi(call_id, user_audio_track)
        active_calls[call_id]["hume_ws"] = hume_ws
        active_calls[call_id]["hume_session"] = hume_session
        # Wire the audio sink queue to the HumeAudioTrack
        active_calls[call_id]["audio_sink"] = hume_audio_out._queue
    else:
        log.warning(f"[{call_id}] No audio track received yet — connecting Hume anyway")
        hume_ws, hume_session = await connect_hume_evi(call_id, None)
        active_calls[call_id]["hume_ws"] = hume_ws
        active_calls[call_id]["hume_session"] = hume_session

    # Step 5: Create SDP answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    # Step 6: Send accept + SDP answer to Meta
    await accept_call(call_id, pc.localDescription.sdp)

    log.info(f"[{call_id}] Call established ✓ — Mello is listening")


def filter_sdp_fingerprints(sdp: str) -> str:
    """
    WhatsApp only supports SHA-256 fingerprints in SDP.
    Filter out any other fingerprint types (sha-1, sha-512 etc).
    Per Pipecat WhatsApp docs recommendation.
    """
    lines = sdp.split("\r\n")
    filtered = []
    for line in lines:
        if line.startswith("a=fingerprint:") and "sha-256" not in line.lower():
            continue  # drop non-SHA-256 fingerprints
        filtered.append(line)
    return "\r\n".join(filtered)


async def cleanup_call(call_id: str):
    """Clean up resources for a finished call."""
    call = active_calls.pop(call_id, None)
    if not call:
        return

    log.info(f"[{call_id}] Cleaning up call")

    # Close Hume WebSocket
    try:
        if "hume_ws" in call:
            await call["hume_ws"].close()
        if "hume_session" in call:
            await call["hume_session"].close()
    except Exception:
        pass

    # Close WebRTC peer connection
    try:
        if "pc" in call:
            await call["pc"].close()
    except Exception:
        pass


# ── Webhook signature verification ────────────────────────────────────────
def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify that webhook is genuinely from Meta using App Secret."""
    if not WHATSAPP_APP_SECRET:
        return True  # skip verification if secret not set
    expected = "sha256=" + hmac.new(
        WHATSAPP_APP_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ── Webhook: GET (verification) ────────────────────────────────────────────
@app.get("/whatsapp")
async def verify_webhook(request: Request):
    params = dict(request.query_params)
    mode      = params.get("hub.mode")
    token     = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == WEBHOOK_VERIFY_TOKEN:
        log.info("WhatsApp call webhook verified ✓")
        return PlainTextResponse(content=challenge)

    raise HTTPException(status_code=403, detail="Verification failed")


# ── Webhook: POST (incoming events) ───────────────────────────────────────
@app.post("/whatsapp")
async def receive_webhook(request: Request):
    """
    Handle WhatsApp call webhook events.
    Event types:
      - connect: incoming call (has SDP offer)
      - disconnect: call ended by user
    """
    body_bytes = await request.body()

    # Verify signature if App Secret is configured
    sig = request.headers.get("x-hub-signature-256", "")
    if WHATSAPP_APP_SECRET and not verify_webhook_signature(body_bytes, sig):
        log.warning("Webhook signature verification failed")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        body = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    log.info(f"Webhook received: {json.dumps(body)[:300]}")

    try:
        entry   = body["entry"][0]
        changes = entry["changes"][0]
        value   = changes["value"]

        # Handle call events
        calls = value.get("calls", [])
        for call in calls:
            call_id   = call.get("id")
            from_phone = call.get("from", "unknown")
            event     = call.get("event")

            if event == "connect":
                # Incoming call — has SDP offer
                session  = call.get("session", {})
                sdp_offer = session.get("sdp", "")
                sdp_type  = session.get("sdp_type", "offer")

                log.info(f"[{call_id}] CONNECT event from {from_phone}")

                # Handle in background so we return 200 immediately
                asyncio.create_task(
                    handle_incoming_call(call_id, from_phone, sdp_offer)
                )

            elif event == "disconnect":
                log.info(f"[{call_id}] DISCONNECT event from {from_phone}")
                await cleanup_call(call_id)

            else:
                log.info(f"[{call_id}] Unknown call event: {event}")

    except (KeyError, IndexError) as e:
        log.error(f"Webhook parse error: {e} — body: {body}")

    # Always return 200 immediately (Meta will retry if we don't)
    return {"status": "ok"}


# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "active_calls": len(active_calls),
        "call_ids": list(active_calls.keys()),
        "hume_configured": bool(HUME_API_KEY),
        "whatsapp_configured": bool(WHATSAPP_TOKEN and WHATSAPP_PHONE_ID),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Run ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    log.info("Starting Mello Voice Call Server...")
    log.info(f"Hume EVI Config ID: {HUME_CONFIG_ID or 'default'}")
    log.info("Webhook URL: https://YOUR_NGROK/whatsapp")
    uvicorn.run("call_server:app", host="0.0.0.0", port=8001, reload=True)
