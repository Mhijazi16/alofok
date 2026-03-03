import logging
import traceback
from datetime import date

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


async def send_eod_alert(report_date: date, rows: list[dict]) -> None:
    """POST an end-of-day summary to Slack. Silent on failure."""
    if not settings.SLACK_WEBHOOK_URL:
        return

    # Build per-rep summary lines
    by_rep: dict[str, list[str]] = {}
    for r in rows:
        rep = r["username"]
        line = (
            f"  • {r['type']} / {r['currency']}: {r['total']:.2f} ({r['cnt']} entries)"
        )
        by_rep.setdefault(rep, []).append(line)

    sections = (
        "\n".join(f"*{rep}*\n" + "\n".join(lines) for rep, lines in by_rep.items())
        or "No transactions today."
    )

    text = f":bar_chart: *EOD Report — {report_date}*\n\n{sections}"
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                settings.SLACK_WEBHOOK_URL,
                json={"text": text},
                timeout=5,
            )
    except Exception:
        logger.warning("Failed to send EOD Slack alert", exc_info=True)
