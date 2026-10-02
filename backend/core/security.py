"""Password hashing (bcrypt), access tokens (JWT) and refresh tokens (opaque)."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET

# bcrypt only uses the first 72 bytes of a password
BCRYPT_MAX_BYTES = 72

# Pre-computed hash so unknown emails take as long as wrong passwords
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        return False
    # Always run one bcrypt check to keep response time constant
    target = password_hash or _DUMMY_HASH
    matched = bcrypt.checkpw(raw, target.encode("utf-8"))
    return matched and password_hash is not None


def create_access_token(employee_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(employee_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    # Returns the employee id, or None when the token is invalid/expired
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )
        if payload["type"] != "access":
            return None
        return int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None


def generate_refresh_token() -> str:
    # 256 bits of randomness; opaque so it can be revoked server-side
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    # High-entropy token, so a fast unsalted hash is sufficient
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
