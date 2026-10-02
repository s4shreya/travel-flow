"""Application-level HTTP errors with a stable JSON body."""

from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(
        self,
        status_code: int,
        message: str,
        *,
        sub_status_code: str | None = None,
        details: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.message = message
        self.sub_status_code = sub_status_code or str(status_code)
        self.details = details
        super().__init__(message)


def not_found(sub_status_code: str, message: str) -> AppException:
    return AppException(status_code=404, sub_status_code=sub_status_code, message=message)


def forbidden(message: str) -> AppException:
    return AppException(status_code=403, sub_status_code="forbidden", message=message)


def error_response(exc: AppException) -> JSONResponse:
    # Return a consistent error envelope for known business failures
    body: dict = {
        "sub_status_code": exc.sub_status_code,
        "message": exc.message,
    }
    if exc.details is not None:
        body["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=body)


async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
    return error_response(exc)
