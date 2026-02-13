#
# Mello Phone Agent - Direct Hume EVI Integration
#
# Uses Hume EVI WebSocket for full speech-to-speech (STT + LLM + TTS in one)
# Based on official Hume EVI Python quickstart:
# https://github.com/HumeAI/hume-api-examples/tree/main/evi/evi-python-quickstart
#
# Copyright (c) 2026, Mello
#

import asyncio
import base64
import datetime
import os
from typing import Optional

from dotenv import load_dotenv
from loguru import logger

from hume.client import AsyncHumeClient
from hume.empathic_voice.types import AudioInput, SubscribeEvent

load_dotenv(override=True)


def extract_top_emotions(emotion_scores: dict, n: int = 3) -> dict:
    """Extract top N emotions from scores."""
    if not emotion_scores:
        return {}
    sorted_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)
    return {emotion: round(score, 2) for emotion, score in sorted_emotions[:n]}


def format_emotions(emotion_scores: dict) -> str:
    """Format emotions for logging."""
    return " | ".join([f"{emotion} ({score:.2f})" for emotion, score in emotion_scores.items()])


def log_with_time(text: str) -> None:
    """Log with timestamp."""
    now = datetime.datetime.now(tz=datetime.timezone.utc).strftime("%H:%M:%S")
    logger.info(f"[{now}] {text}")


class HumeEVIBot:
    """
    Bridges WhatsApp WebRTC audio to Hume EVI WebSocket.

    Hume EVI handles the complete pipeline:
    - Speech-to-text (transcription)
    - LLM processing (configured in your Hume dashboard)
    - Text-to-speech (empathic voice)
    - Emotion analysis

    Audio flow:
    WhatsApp (WebRTC) → Hume EVI WebSocket → WhatsApp (WebRTC)
    """

    def __init__(
        self,
        hume_api_key: str,
        hume_config_id: str,
        hume_secret_key: Optional[str] = None,
    ):
        self.hume_api_key = hume_api_key
        self.hume_config_id = hume_config_id
        self.hume_secret_key = hume_secret_key
        self.client: Optional[AsyncHumeClient] = None
        self.socket = None
        self._running = False

        # Audio output queue (Hume → WhatsApp)
        self._output_queue: asyncio.Queue[bytes] = asyncio.Queue()

    async def connect(self):
        """Connect to Hume EVI WebSocket."""
        logger.info("🔗 Connecting to Hume EVI...")

        self.client = AsyncHumeClient(api_key=self.hume_api_key)

        # Connect with config_id
        self.socket = await self.client.empathic_voice.chat.connect(
            config_id=self.hume_config_id
        ).__aenter__()

        self._running = True
        logger.info("✅ Connected to Hume EVI")

    async def disconnect(self):
        """Disconnect from Hume EVI."""
        self._running = False
        if self.socket:
            await self.socket.__aexit__(None, None, None)
        logger.info("📴 Disconnected from Hume EVI")

    async def send_audio(self, audio_data: bytes):
        """
        Send audio to Hume EVI.

        Args:
            audio_data: Raw PCM audio bytes
        """
        if self.socket and self._running:
            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
            await self.socket.send_publish(AudioInput(data=audio_b64))

    async def get_audio_output(self, timeout: float = 0.1) -> Optional[bytes]:
        """
        Get audio output from Hume EVI.

        Args:
            timeout: How long to wait for audio

        Returns:
            Audio bytes or None if timeout
        """
        try:
            return await asyncio.wait_for(self._output_queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def process_messages(self):
        """Process incoming messages from Hume EVI."""
        logger.info("🎧 Starting Hume EVI message processor")

        try:
            async for message in self.socket:
                await self._handle_message(message)

                if not self._running:
                    break

        except Exception as e:
            logger.error(f"❌ Message processor error: {e}")
        finally:
            logger.info("🛑 Message processor stopped")

    async def _handle_message(self, message: SubscribeEvent):
        """Handle a single message from Hume EVI."""

        if message.type == "chat_metadata":
            log_with_time(f"📝 Chat started - ID: {message.chat_id}")

        elif message.type == "user_message":
            # User's transcribed speech
            content = message.message.content if message.message else ""
            log_with_time(f"👤 User: {content}")

            # Log detected emotions
            if message.models and message.models.prosody and message.models.prosody.scores:
                emotions = extract_top_emotions(dict(message.models.prosody.scores), 3)
                logger.debug(f"   Emotions: {format_emotions(emotions)}")

        elif message.type == "assistant_message":
            # EVI's response text
            content = message.message.content if message.message else ""
            log_with_time(f"🤖 Mello: {content}")

        elif message.type == "audio_output":
            # EVI's voice response - decode and queue for WhatsApp
            if message.data:
                audio_bytes = base64.b64decode(message.data.encode("utf-8"))
                await self._output_queue.put(audio_bytes)

        elif message.type == "user_interruption":
            logger.debug("⚡ User interrupted")

        elif message.type == "error":
            code = getattr(message, 'code', 'unknown')
            msg = getattr(message, 'message', str(message))
            logger.error(f"❌ Hume error ({code}): {msg}")

        else:
            logger.debug(f"<{message.type}>")


async def run_bot(webrtc_connection):
    """
    Run Mello Phone Agent with Hume EVI.

    This bridges WhatsApp WebRTC audio to Hume EVI for a complete
    speech-to-speech experience with emotional intelligence.

    Args:
        webrtc_connection: SmallWebRTCConnection from WhatsApp/Pipecat
    """
    logger.info("🎭 Starting Mello with Hume EVI")

    hume_api_key = os.getenv("HUME_API_KEY")
    hume_config_id = os.getenv("HUME_CONFIG_ID")
    hume_secret_key = os.getenv("HUME_SECRET_KEY")

    if not hume_api_key or not hume_config_id:
        raise ValueError("HUME_API_KEY and HUME_CONFIG_ID required")

    # Create Hume EVI bot
    bot = HumeEVIBot(
        hume_api_key=hume_api_key,
        hume_config_id=hume_config_id,
        hume_secret_key=hume_secret_key,
    )

    try:
        await bot.connect()

        # Run tasks concurrently:
        # 1. Process Hume messages (handles audio output queue)
        # 2. Forward WebRTC audio to Hume
        # 3. Forward Hume audio to WebRTC
        await asyncio.gather(
            bot.process_messages(),
            _forward_webrtc_to_hume(webrtc_connection, bot),
            _forward_hume_to_webrtc(bot, webrtc_connection),
        )

    except Exception as e:
        logger.error(f"❌ Bot error: {e}")
    finally:
        await bot.disconnect()
        logger.info("🛑 Mello Hume EVI session ended")


async def _forward_webrtc_to_hume(webrtc_connection, bot: HumeEVIBot):
    """
    Forward audio from WhatsApp WebRTC to Hume EVI.

    Note: Actual implementation depends on SmallWebRTCConnection internals.
    The connection uses aiortc RTCPeerConnection with audio tracks.
    """
    logger.debug("🎤 Starting WebRTC → Hume audio forwarding")

    # Access the aiortc peer connection
    # SmallWebRTCConnection wraps RTCPeerConnection
    pc = getattr(webrtc_connection, '_pc', None)

    if not pc:
        logger.warning("Could not access peer connection")
        return

    try:
        while bot._running:
            # Get audio from WebRTC receiver track
            # This is a placeholder - actual implementation needs to:
            # 1. Find the audio transceiver
            # 2. Get frames from the receiver track
            # 3. Encode as PCM and send to Hume

            # Example pattern (needs aiortc track handling):
            # for transceiver in pc.getTransceivers():
            #     if transceiver.receiver.track and transceiver.receiver.track.kind == "audio":
            #         frame = await transceiver.receiver.track.recv()
            #         audio_data = frame.to_ndarray().tobytes()
            #         await bot.send_audio(audio_data)

            await asyncio.sleep(0.02)  # 20ms buffer window (Hume recommendation)

    except asyncio.CancelledError:
        logger.debug("WebRTC → Hume forwarding cancelled")
    except Exception as e:
        logger.error(f"WebRTC → Hume error: {e}")


async def _forward_hume_to_webrtc(bot: HumeEVIBot, webrtc_connection):
    """
    Forward audio from Hume EVI to WhatsApp WebRTC.

    Note: Actual implementation depends on SmallWebRTCConnection internals.
    """
    logger.debug("🔊 Starting Hume → WebRTC audio forwarding")

    try:
        while bot._running:
            # Get audio from Hume output queue
            audio_data = await bot.get_audio_output(timeout=0.1)

            if audio_data:
                # Send to WebRTC sender track
                # This is a placeholder - actual implementation needs to:
                # 1. Find the audio transceiver
                # 2. Create audio frames from PCM data
                # 3. Send through the sender track

                # Example pattern (needs aiortc track handling):
                # for transceiver in pc.getTransceivers():
                #     if transceiver.sender.track and transceiver.sender.track.kind == "audio":
                #         frame = av.AudioFrame.from_ndarray(audio_array, format='s16', layout='mono')
                #         await transceiver.sender.track._queue.put(frame)
                pass

    except asyncio.CancelledError:
        logger.debug("Hume → WebRTC forwarding cancelled")
    except Exception as e:
        logger.error(f"Hume → WebRTC error: {e}")


# =====================================================
# IMPORTANT NOTE
# =====================================================
# This direct Hume EVI integration requires bridging WebRTC audio tracks
# with Hume's WebSocket. The audio forwarding functions above are templates.
#
# For a working implementation, you need to:
# 1. Access SmallWebRTCConnection's internal RTCPeerConnection
# 2. Read from the receiver's audio track (user audio)
# 3. Write to the sender's audio track (bot audio)
#
# The simpler approach is to use bot.py which leverages Pipecat's
# built-in audio handling with Gemini Live or OpenAI + Hume TTS.
#
# Reference implementations:
# - Pipecat WhatsApp example: https://github.com/pipecat-ai/pipecat-examples/tree/main/whatsapp
# - Hume EVI quickstart: https://github.com/HumeAI/hume-api-examples/tree/main/evi/evi-python-quickstart
# =====================================================
