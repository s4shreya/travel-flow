"""CSRF protection for cookie-authenticated requests (Origin header check)."""

from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from core.config import CORS_ORIGINS, logger

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """
    Reject state-changing requests sent by a browser from an untrusted origin.
    Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, so a
    forged form or fetch from another site is blocked even though cookies ride along.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        origin = request.headers.get("origin")
        # Non-browser clients (curl, server-to-server) send no Origin and are not CSRF vectors
        if (
            request.method not in SAFE_METHODS
            and origin
            and not _is_trusted(origin, request)
        ):
            logger.warning(
                f"Blocked cross-origin {request.method} {request.url.path} from {origin}"
            )
            return JSONResponse(
                status_code=403,
                content={
                    "sub_status_code": "origin_not_allowed",
                    "message": "Request origin is not allowed",
                },
            )
        return await call_next(request)


def _is_trusted(origin: str, request: Request) -> bool:
    if origin in CORS_ORIGINS:
        return True
    # Same-origin calls (e.g. Swagger UI served by this API)
    return urlparse(origin).netloc == request.headers.get("host")
