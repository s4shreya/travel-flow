import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from core.config import REFRESH_TOKEN_EXPIRE_DAYS, logger
from core.exceptions import AppException
from core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    verify_password,
)
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.refresh_token import RefreshToken

# Matches refresh_tokens.user_agent column length
USER_AGENT_MAX_LENGTH = 255

@dataclass
class AuthSession:
    employee: Employee
    access_token: str
    refresh_token: str


def _invalid_session() -> AppException:
    return AppException(
        status_code=401,
        sub_status_code="invalid_refresh_token",
        message="Session expired, please sign in again",
    )


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def login(self, email: str, password: str, user_agent: str | None) -> AuthSession:
        # Look up by case-insensitive email
        normalized = email.strip().lower()
        stmt = select(Employee).where(func.lower(Employee.email) == normalized)
        employee = self.db.execute(stmt).scalar_one_or_none()

        # Same error for unknown email, wrong password, or inactive account
        password_hash = employee.password_hash if employee else None
        if not verify_password(password, password_hash) or not employee.is_active:
            logger.info(f"Failed login for {normalized}")
            raise AppException(
                status_code=401,
                sub_status_code="invalid_credentials",
                message="Invalid email or password",
            )

        now = datetime.now(timezone.utc)
        self.db.execute(
            delete(RefreshToken).where(
                RefreshToken.employee_id == employee.id,
                RefreshToken.expires_at < now,
            )
        )

        # Record the login and start a new token family (one per session)
        employee.last_login_at = now
        session = self._issue(employee, family_id=uuid.uuid4().hex, user_agent=user_agent)
        self.db.commit()
        logger.info(f"Login success for {employee.employee_code}")
        return session

    def refresh(self, raw_token: str | None, user_agent: str | None) -> AuthSession:
        if not raw_token:
            raise _invalid_session()

        # Lock the row so parallel refreshes cannot rotate the same token twice
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
            .with_for_update()
        )
        token = self.db.execute(stmt).scalar_one_or_none()
        if token is None:
            raise _invalid_session()

        now = datetime.now(timezone.utc)

        # Reuse of a rotated token means it was stolen: kill the whole session
        if token.revoked_at is not None:
            self._revoke_family(token.family_id, now)
            self.db.commit()
            logger.warning(
                f"Refresh token reuse detected for employee {token.employee_id}; "
                f"family {token.family_id} revoked"
            )
            raise _invalid_session()

        if token.expires_at <= now:
            raise _invalid_session()

        employee = EmployeeCRUD(self.db).get_by("id", token.employee_id)
        if employee is None or not employee.is_active:
            self._revoke_family(token.family_id, now)
            self.db.commit()
            raise _invalid_session()

        # Rotate: revoke the presented token and issue a new one in the same family
        token.revoked_at = now
        session = self._issue(employee, family_id=token.family_id, user_agent=user_agent)
        self.db.commit()
        return session

    def logout(self, raw_token: str | None) -> None:
        # Revoke the whole session; unknown tokens are ignored
        if not raw_token:
            return
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw_token)
        )
        token = self.db.execute(stmt).scalar_one_or_none()
        if token is None:
            return
        self._revoke_family(token.family_id, datetime.now(timezone.utc))
        self.db.commit()

    def _issue(
        self, employee: Employee, *, family_id: str, user_agent: str | None
    ) -> AuthSession:
        # Store only the hash; the raw token goes to the cookie
        raw = generate_refresh_token()
        self.db.add(
            RefreshToken(
                employee_id=employee.id,
                family_id=family_id,
                token_hash=hash_refresh_token(raw),
                expires_at=datetime.now(timezone.utc)
                + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
                user_agent=(user_agent or "")[:USER_AGENT_MAX_LENGTH] or None,
            )
        )
        return AuthSession(
            employee=employee,
            access_token=create_access_token(employee.id),
            refresh_token=raw,
        )

    def _revoke_family(self, family_id: str, now: datetime) -> None:
        self.db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.family_id == family_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
