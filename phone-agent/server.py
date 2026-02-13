#
# Mello Phone Agent Server
# WhatsApp WebRTC Server for Mental Health Voice AI
#
# Copyright (c) 2026, Mello
# Based on Pipecat WhatsApp example (BSD 2-Clause License)
#

"""
Mello Phone Agent Server

A FastAPI server that handles WhatsApp webhook events and manages WebRTC connections
for real-time voice communication with WhatsApp users. Integrates Hume.ai EVI for
empathic voice responses in mental health support conversations.

Environment Variables Required:
- HUME_API_KEY: Hume.ai API key
- HUME_VOICE_ID: Hume voice ID
- WHATSAPP_TOKEN: WhatsApp Business API access token
- WHATSAPP_WEBHOOK_VERIFICATION_TOKEN: Token for webhook verification
- WHATSAPP_PHONE_NUMBER_ID: WhatsApp Business phone number ID

Usage:
    python server.py --host 0.0.0.0 --port 7860 --verbose
"""

import argparse
import asyncio
import signal
import sys
from contextlib import asynccontextmanager
from typing import Optional

import aiohttp
import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from loguru import logger
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.whatsapp.api import WhatsAppWebhookRequest
from pipecat.transports.whatsapp.client import WhatsAppClient

from bot import run_bot

# Load environment variables
load_dotenv(override=True)
import os

# Configuration from environment
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN = os.getenv("WHATSAPP_WEBHOOK_VERIFICATION_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

# Validate required environment variables
required_vars = {
    "WHATSAPP_TOKEN": WHATSAPP_TOKEN,
    "WHATSAPP_WEBHOOK_VERIFICATION_TOKEN": WHATSAPP_WEBHOOK_VERIFICATION_TOKEN,
    "WHATSAPP_PHONE_NUMBER_ID": WHATSAPP_PHONE_NUMBER_ID,
}

missing_vars = [name for name, value in required_vars.items() if not value]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Global state
whatsapp_client: Optional[WhatsAppClient] = None
shutdown_event = asyncio.Event()
active_calls: dict[str, asyncio.Task] = {}


def signal_handler() -> None:
    """Handle shutdown signals gracefully."""
    logger.info("🛑 Received shutdown signal, initiating graceful shutdown...")
    shutdown_event.set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan and resources."""
    global whatsapp_client

    logger.info("🚀 Starting Mello Phone Agent Server")
    logger.info(f"📞 Phone Number ID: {WHATSAPP_PHONE_NUMBER_ID}")

    # Initialize WhatsApp client with persistent HTTP session
    async with aiohttp.ClientSession() as session:
        whatsapp_client = WhatsAppClient(
            whatsapp_token=WHATSAPP_TOKEN,
            phone_number_id=WHATSAPP_PHONE_NUMBER_ID,
            session=session,
        )
        logger.info("✅ WhatsApp client initialized")

        try:
            yield
        finally:
            # Cleanup on shutdown
            logger.info("🧹 Cleaning up resources...")

            # Cancel all active calls
            for call_id, task in active_calls.items():
                logger.info(f"📴 Cancelling call: {call_id}")
                task.cancel()

            # Terminate all WhatsApp calls
            if whatsapp_client:
                await whatsapp_client.terminate_all_calls()

            logger.info("👋 Mello Phone Agent shutdown complete")


# Initialize FastAPI app
app = FastAPI(
    title="Mello Phone Agent",
    description="WhatsApp Voice AI for mental health support powered by Hume.ai EVI",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "mello-phone-agent",
        "active_calls": len(active_calls),
    }


@app.get("/webhook")
async def verify_webhook(request: Request):
    """
    Verify WhatsApp webhook endpoint.

    Called by Meta to verify webhook URL during setup.
    """
    params = dict(request.query_params)
    logger.debug(f"📥 Webhook verification request: {list(params.keys())}")

    try:
        result = await whatsapp_client.handle_verify_webhook_request(
            params=params,
            expected_verification_token=WHATSAPP_WEBHOOK_VERIFICATION_TOKEN,
        )
        logger.info("✅ Webhook verified successfully")
        return result
    except ValueError as e:
        logger.warning(f"❌ Webhook verification failed: {e}")
        raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhook")
async def handle_webhook(body: WhatsAppWebhookRequest, background_tasks: BackgroundTasks):
    """
    Handle incoming WhatsApp webhook events.

    Processes:
    - Incoming voice calls
    - Call status updates
    - Call terminations
    """
    if body.object != "whatsapp_business_account":
        logger.warning(f"⚠️ Invalid webhook object type: {body.object}")
        raise HTTPException(status_code=400, detail="Invalid object type")

    logger.info(f"📥 Webhook received: {body.dict()}")

    async def connection_callback(connection: SmallWebRTCConnection):
        """
        Handle new WebRTC connections from WhatsApp calls.

        Spawns a Mello bot instance to handle the conversation.
        """
        call_id = connection.pc_id
        logger.info(f"📞 New call connected: {call_id}")

        try:
            # Create task for the bot
            task = asyncio.create_task(run_bot(connection))
            active_calls[call_id] = task

            # Add cleanup when task completes
            def cleanup_call(t):
                active_calls.pop(call_id, None)
                logger.info(f"📴 Call ended: {call_id}")

            task.add_done_callback(cleanup_call)

        except Exception as e:
            logger.error(f"❌ Failed to start bot for call {call_id}: {e}")
            try:
                await connection.disconnect()
            except Exception as disconnect_error:
                logger.error(f"Failed to disconnect: {disconnect_error}")

    try:
        result = await whatsapp_client.handle_webhook_request(body, connection_callback)
        logger.debug(f"✅ Webhook processed: {result}")
        return {"status": "success"}
    except ValueError as ve:
        logger.warning(f"⚠️ Invalid webhook format: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"❌ Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def run_server(host: str, port: int) -> None:
    """Run the server with signal handling."""
    loop = asyncio.get_running_loop()

    # Set up signal handlers (Unix only)
    if sys.platform != "win32":
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, signal_handler)

    # Configure server
    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_config=None,
    )
    server = uvicorn.Server(config)

    # Start server
    server_task = asyncio.create_task(server.serve())
    logger.info(f"🌐 Server running on http://{host}:{port}")
    logger.info("📞 Ready to receive WhatsApp calls")
    logger.info("Press Ctrl+C to stop")

    # Wait for shutdown
    if sys.platform == "win32":
        # Windows: just run until keyboard interrupt
        try:
            await server_task
        except asyncio.CancelledError:
            pass
    else:
        # Unix: wait for shutdown signal
        await shutdown_event.wait()
        server.should_exit = True
        await server_task

    logger.info("✅ Server shutdown complete")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Mello Phone Agent - WhatsApp Voice AI Server"
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=7860, help="Port (default: 7860)")
    parser.add_argument("--verbose", "-v", action="count", default=0)
    args = parser.parse_args()

    # Configure logging
    logger.remove(0)
    if args.verbose:
        logger.add(sys.stderr, level="TRACE")
    else:
        logger.add(sys.stderr, level="DEBUG")

    logger.info("🎭 Mello Phone Agent v0.1.0")
    logger.info("Mental health voice support powered by Hume.ai EVI")

    try:
        asyncio.run(run_server(args.host, args.port))
    except KeyboardInterrupt:
        logger.info("👋 Interrupted by user")
    except Exception as e:
        logger.error(f"💥 Fatal error: {e}")
        sys.exit(1)
