from pydantic import BaseModel, Field, field_validator

from src.me.schemas import MeResponse


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        # Case-insensitive login; basic shape check only (no account enumeration)
        cleaned = value.strip().lower()
        local, _, domain = cleaned.partition("@")
        if not local or "." not in domain or " " in cleaned:
            raise ValueError("Enter a valid email address")
        return cleaned


class TokenResponse(MeResponse):
    """Signed-in profile + short-lived access token."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
