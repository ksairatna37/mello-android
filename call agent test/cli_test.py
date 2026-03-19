"""
Hume EVI CLI Test (Python)
--------------------------
Test EVI directly from your terminal using your microphone.
Uses the official Hume Python SDK.

Usage:
    python cli_test.py
"""

import asyncio
import os
import datetime
from dotenv import load_dotenv

from hume import MicrophoneInterface, Stream
from hume.client import AsyncHumeClient
from hume.empathic_voice.types import SubscribeEvent

load_dotenv()


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────
def log(text: str) -> None:
    now = datetime.datetime.now(tz=datetime.timezone.utc).strftime("%H:%M:%S")
    print(f"[{now}] {text}")


def top_emotions(scores: dict, n: int = 3) -> str:
    top = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:n]
    return " | ".join(f"{e}({s:.2f})" for e, s in top)


# ─────────────────────────────────────────
# Message handler
# ─────────────────────────────────────────
def on_message(message: SubscribeEvent):
    msg_type = message.type

    if msg_type == "chat_metadata":
        log(f"📌 Session started — chat_id: {message.chat_id}")

    elif msg_type == "user_message":
        content = message.message.content if message.message else ""
        emotions = {}
        if hasattr(message, "models") and message.models:
            prosody = getattr(message.models, "prosody", None)
            if prosody and hasattr(prosody, "scores"):
                emotions = prosody.scores or {}
        emotion_str = f"  [{top_emotions(emotions)}]" if emotions else ""
        log(f"🧑 YOU: {content}{emotion_str}")

    elif msg_type == "assistant_message":
        content = message.message.content if message.message else ""
        log(f"🤖 EVI: {content}")

    elif msg_type == "assistant_end":
        log("✅ EVI finished speaking — your turn!")

    elif msg_type == "audio_output":
        pass  # SDK handles playback automatically via MicrophoneInterface

    elif msg_type == "error":
        log(f"❌ Error: {message.message}")
        raise Exception(f"EVI error: {message.message}")

    else:
        log(f"📨 [{msg_type}]")


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────
async def main():
    api_key   = os.getenv("HUME_API_KEY")
    config_id = os.getenv("HUME_CONFIG_ID", None)

    if not api_key:
        print("❌ HUME_API_KEY not found. Set it in .env file.")
        return

    print("\n" + "═" * 50)
    print("  Hume EVI CLI Test")
    print("  Speak into your microphone. Press Ctrl+C to exit.")
    print("═" * 50 + "\n")

    client = AsyncHumeClient(api_key=api_key)

    try:
        connect_kwargs = {}
        if config_id:
            connect_kwargs["config_id"] = config_id
            log(f"Using config: {config_id}")
        else:
            log("Using default EVI config (no config_id set)")

        async with client.empathic_voice.chat.connect(**connect_kwargs) as socket:
            log("Connected to Hume EVI ✓")
            log("Listening… speak now!\n")

            async with Stream.new() as stream:
                asyncio.ensure_future(
                    MicrophoneInterface.start(
                        socket,
                        byte_stream=stream,
                        allow_user_interrupt=True,
                    )
                )
                async for message in socket:
                    on_message(message)

    except KeyboardInterrupt:
        log("Session ended by user.")
    except Exception as e:
        log(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
