"""Simple in-memory login throttle."""

import time
from collections import defaultdict, deque
from threading import Lock

from core.exceptions import AppException

MAX_FAILED_LOGINS = 5
WINDOW_SECONDS = 15 * 60


class LoginThrottle:
    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        # Drop failures older than the window
        attempts = self._failures[key]
        while attempts and now - attempts[0] > WINDOW_SECONDS:
            attempts.popleft()
        return attempts

    def check(self, key: str) -> None:
        """Raise 429 when this key has too many recent failures."""
        now = time.monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            if len(attempts) >= MAX_FAILED_LOGINS:
                retry_after = int(WINDOW_SECONDS - (now - attempts[0])) + 1
                minutes = max(1, round(retry_after / 60))
                raise AppException(
                    status_code=429,
                    sub_status_code="too_many_attempts",
                    message=f"Too many failed sign-in attempts. Try again in {minutes} min.",
                )

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


login_throttle = LoginThrottle()
