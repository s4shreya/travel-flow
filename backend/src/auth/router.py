from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_COOKIE_NAME
from core.exceptions import AppException, error_response
from core.rate_limit import login_throttle
from database.postgres.session import get_db
from src.auth.cookies import clear_refresh_cookie, set_refresh_cookie
from src.auth.schemas import LoginRequest, TokenResponse
from src.auth.service import AuthService, AuthSession

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_response(response: Response, session: AuthSession) -> TokenResponse:
    # Refresh token → httpOnly cookie; access token → JSON body (kept in memory by the client)
    set_refresh_cookie(response, session.refresh_token)
    response.headers["Cache-Control"] = "no-store"
    return TokenResponse.for_employee(
        session.employee,
        access_token=session.access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse, summary="Sign in with email + password")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    # Throttle brute force per client IP + email
    client_ip = request.client.host if request.client else "unknown"
    throttle_key = f"{client_ip}:{payload.email}"
    login_throttle.check(throttle_key)

    try:
        session = AuthService(db).login(
            payload.email, payload.password, request.headers.get("user-agent")
        )
    except AppException as exc:
        if exc.status_code == 401:
            login_throttle.record_failure(throttle_key)
        raise
    login_throttle.reset(throttle_key)
    return _session_response(response, session)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate the refresh token and issue a new access token",
)
def refresh(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse | JSONResponse:
    try:
        session = AuthService(db).refresh(
            request.cookies.get(REFRESH_COOKIE_NAME),
            request.headers.get("user-agent"),
        )
    except AppException as exc:
        # Clear the stale cookie so the browser stops retrying with it
        error = error_response(exc)
        clear_refresh_cookie(error)
        return error
    return _session_response(response, session)


@router.post("/logout", status_code=204, summary="Sign out (revokes the session)")
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    AuthService(db).logout(request.cookies.get(REFRESH_COOKIE_NAME))
    clear_refresh_cookie(response)
