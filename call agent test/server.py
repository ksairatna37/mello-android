"""
Hume EVI Test Server
--------------------
- FastAPI backend that acts as a bridge between the browser and Hume EVI
- Browser sends audio chunks via WebSocket → this server → Hume EVI WebSocket
- Hume EVI audio responses → this server → Browser WebSocket
"""

import asyncio
import base64
import json
import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import websockets
import httpx

load_dotenv()

app = FastAPI()

HUME_API_KEY = os.getenv("HUME_API_KEY")
HUME_CONFIG_ID = os.getenv("HUME_CONFIG_ID", "")  # Optional: leave blank for default EVI config

# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "hume_key_set": bool(HUME_API_KEY)}


# ─────────────────────────────────────────────
# Token endpoint (browser uses this to connect
# directly to Hume EVI without exposing API key)
# ─────────────────────────────────────────────
@app.get("/get-hume-token")
async def get_hume_token():
    """
    Fetches a short-lived access token from Hume's REST API.
    The browser uses this token instead of the raw API key.
    """
    if not HUME_API_KEY:
        return {"error": "HUME_API_KEY not set in .env"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.hume.ai/oauth2-cc/token",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "client_credentials",
                "client_id": HUME_API_KEY,       # For API key auth: client_id = API key
                "client_secret": os.getenv("HUME_SECRET_KEY", ""),
            },
        )

    # If you're using API key auth (not OAuth), return the key directly
    # The browser SDK accepts either an access_token OR an api_key
    if resp.status_code != 200:
        # Fall back: return API key directly (fine for local dev testing)
        return {
            "access_token": None,
            "api_key": HUME_API_KEY,
            "config_id": HUME_CONFIG_ID,
        }

    data = resp.json()
    return {
        "access_token": data.get("access_token"),
        "api_key": None,
        "config_id": HUME_CONFIG_ID,
    }


# ─────────────────────────────────────────────
# WebSocket proxy bridge
# Browser ↔ This server ↔ Hume EVI WebSocket
# (Alternative to direct browser connection)
# ─────────────────────────────────────────────
@app.websocket("/ws/evi")
async def evi_proxy(browser_ws: WebSocket):
    await browser_ws.accept()
    print("Browser connected to EVI proxy")

    config_param = f"&config_id={HUME_CONFIG_ID}" if HUME_CONFIG_ID else ""
    hume_url = f"wss://api.hume.ai/v0/evi/chat?api_key={HUME_API_KEY}{config_param}"

    try:
        async with websockets.connect(hume_url) as hume_ws:
            print("Connected to Hume EVI")

            async def browser_to_hume():
                """Forward browser audio chunks to Hume EVI"""
                try:
                    while True:
                        data = await browser_ws.receive_text()
                        await hume_ws.send(data)
                except WebSocketDisconnect:
                    print("Browser disconnected")

            async def hume_to_browser():
                """Forward Hume EVI responses back to browser"""
                try:
                    async for message in hume_ws:
                        await browser_ws.send_text(message if isinstance(message, str) else message.decode())
                except Exception as e:
                    print(f"Hume connection closed: {e}")

            # Run both directions concurrently
            await asyncio.gather(
                browser_to_hume(),
                hume_to_browser(),
                return_exceptions=True,
            )

    except Exception as e:
        print(f"EVI proxy error: {e}")
        try:
            await browser_ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except:
            pass


# ─────────────────────────────────────────────
# Serve the frontend HTML
# ─────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def root():
    with open("static/index.html") as f:
        return f.read()

app.mount("/static", StaticFiles(directory="static"), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
