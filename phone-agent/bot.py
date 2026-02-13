#
# Mello Phone Agent Bot - WhatsApp Voice AI
#
# Uses Hume EVI for empathic speech-to-speech (NO TWILIO)
# Direct WhatsApp Cloud API integration via Pipecat
#
# Copyright (c) 2026, Mello
#

import asyncio
import base64
import os

from dotenv import load_dotenv
from loguru import logger

from hume.client import AsyncHumeClient
from hume.empathic_voice.types import SubscribeEvent
from hume.empathic_voice import AudioInput

from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.base_transport import TransportParams

load_dotenv(override=True)


class HumeEVIHandler:
    """
    Bridges WhatsApp WebRTC audio to Hume EVI.

    Hume EVI handles the complete pipeline:
    - Speech-to-text
    - LLM processing (configured in your Hume dashboard)
    - Empathic text-to-speech
    - Emotion detection
    """

    def __init__(self, api_key: str, config_id: str):
        self.api_key = api_key
        self.config_id = config_id
        self.client = AsyncHumeClient(api_key=api_key)
        self.socket = None
        self._running = False
        self._output_queue: asyncio.Queue[bytes] = asyncio.Queue()

    async def connect(self):
        """Connect to Hume EVI WebSocket."""
        logger.info("🔌 Connecting to Hume EVI...")

        # Session settings for telephony audio (8kHz)
        session_settings = {
            "audio": {
                "encoding": "linear16",
                "sample_rate": 16000,  # Hume prefers 16kHz
                "channels": 1
            }
        }

        self.socket = await self.client.empathic_voice.chat.connect(
            config_id=self.config_id,
            session_settings=session_settings
        ).__aenter__()

        self._running = True
        logger.info("✅ Connected to Hume EVI")

    async def disconnect(self):
        """Disconnect from Hume EVI."""
        self._running = False
        if self.socket:
            try:
                await self.socket.__aexit__(None, None, None)
            except Exception:
                pass
        logger.info("📴 Disconnected from Hume EVI")

    async def send_audio(self, audio_data: bytes):
        """Send audio to Hume EVI."""
        if self.socket and self._running:
            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
            await self.socket.send_publish(AudioInput(data=audio_b64))

    async def get_output_audio(self, timeout: float = 0.05) -> bytes | None:
        """Get audio output from Hume EVI."""
        try:
            return await asyncio.wait_for(self._output_queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def process_messages(self):
        """Process incoming messages from Hume EVI."""
        try:
            async for message in self.socket:
                await self._handle_message(message)
                if not self._running:
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"❌ EVI message error: {e}")

    async def _handle_message(self, message: SubscribeEvent):
        """Handle a message from Hume EVI."""
        if message.type == "chat_metadata":
            logger.info(f"📝 Chat started: {message.chat_id}")

        elif message.type == "user_message":
            content = message.message.content if message.message else ""
            logger.info(f"👤 User: {content}")

            # Log emotions
            if message.models and message.models.prosody and message.models.prosody.scores:
                scores = dict(message.models.prosody.scores)
                top = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:3]
                emotions = " | ".join([f"{k}: {v:.2f}" for k, v in top])
                logger.debug(f"   Emotions: {emotions}")

        elif message.type == "assistant_message":
            content = message.message.content if message.message else ""
            logger.info(f"🤖 Mello: {content}")

        elif message.type == "audio_output":
            # Queue audio for sending to WhatsApp
            if message.data:
                audio_bytes = base64.b64decode(message.data.encode("utf-8"))
                await self._output_queue.put(audio_bytes)

        elif message.type == "user_interruption":
            logger.debug("⚡ User interrupted")

        elif message.type == "error":
            logger.error(f"❌ EVI error: {getattr(message, 'message', str(message))}")


async def run_bot(webrtc_connection):
    """
    Run Mello voice bot for a WhatsApp call.

    Uses:
    - Pipecat SmallWebRTCTransport for WhatsApp audio
    - Hume EVI for empathic speech-to-speech

    Args:
        webrtc_connection: SmallWebRTCConnection from WhatsApp
    """
    logger.info("🎭 Starting Mello bot for WhatsApp call")

    hume_api_key = os.getenv("HUME_API_KEY")
    hume_config_id = os.getenv("HUME_CONFIG_ID")

    if not hume_api_key or not hume_config_id:
        logger.error("❌ HUME_API_KEY and HUME_CONFIG_ID required")
        return

    # Create Hume EVI handler
    hume = HumeEVIHandler(api_key=hume_api_key, config_id=hume_config_id)

    # Create Pipecat transport for WhatsApp audio
    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    )

    try:
        # Connect to Hume EVI
        await hume.connect()

        # Set up event handlers
        connected = asyncio.Event()
        disconnected = asyncio.Event()

        @transport.event_handler("on_client_connected")
        async def on_connected(transport, client):
            logger.info("📞 WhatsApp caller connected")
            connected.set()

        @transport.event_handler("on_client_disconnected")
        async def on_disconnected(transport, client):
            logger.info("📴 WhatsApp caller disconnected")
            disconnected.set()

        # Start tasks
        tasks = [
            asyncio.create_task(hume.process_messages(), name="hume_messages"),
            asyncio.create_task(_forward_whatsapp_to_hume(transport, hume), name="wa_to_hume"),
            asyncio.create_task(_forward_hume_to_whatsapp(hume, transport), name="hume_to_wa"),
        ]

        # Wait for call to end
        await disconnected.wait()

        # Cancel tasks
        for task in tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    except Exception as e:
        logger.error(f"❌ Bot error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await hume.disconnect()
        logger.info("🛑 Mello bot session ended")


async def _forward_whatsapp_to_hume(transport: SmallWebRTCTransport, hume: HumeEVIHandler):
    """Forward audio from WhatsApp to Hume EVI."""
    logger.debug("🎤 Starting WhatsApp → Hume audio forwarding")

    try:
        # Get audio frames from transport input
        async for frame in transport.input():
            if hasattr(frame, 'audio') and frame.audio:
                await hume.send_audio(frame.audio)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"WhatsApp → Hume error: {e}")


async def _forward_hume_to_whatsapp(hume: HumeEVIHandler, transport: SmallWebRTCTransport):
    """Forward audio from Hume EVI to WhatsApp."""
    logger.debug("🔊 Starting Hume → WhatsApp audio forwarding")

    try:
        while hume._running:
            audio = await hume.get_output_audio()
            if audio:
                # Send audio through transport output
                # Note: May need to create proper audio frame
                await transport.send_audio(audio)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Hume → WhatsApp error: {e}")
