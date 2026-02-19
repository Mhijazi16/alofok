import logging
import traceback

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.errors import HorizonException
from app.utils.slack import send_error_alert

logger = logging.getLogger(__name__)


class GlobalErrorHandler(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except HorizonException as exc:
            logger.warning("HorizonException [%s]: %s", exc.status_code, exc.detail)
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
            )
        except Exception as exc:
            logger.error("Unhandled exception:\n%s", traceback.format_exc())
            await send_error_alert(request.method, request.url.path, exc)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
