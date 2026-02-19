import logging
import traceback

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_error_alert(method: str, path: str, exc: Exception) -> None:
    """POST a 500-error summary to the configured Slack webhook. Silent on failure."""
    if not settings.SLACK_WEBHOOK_URL:
        return

    text = (
        f":red_circle: *500 Error* on `{method} {path}`\n"
        f"```{traceback.format_exc()[-2000:]}```"
    )
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                settings.SLACK_WEBHOOK_URL,
                json={"text": text},
                timeout=5,
            )
    except Exception:
        logger.warning("Failed to send Slack alert", exc_info=True)
