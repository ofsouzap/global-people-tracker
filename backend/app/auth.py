"""Authentication dependency boundary."""

from __future__ import annotations

import os
from dataclasses import dataclass
from uuid import UUID

from fastapi import Header, HTTPException, status


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """The internal application identity used to scope all persisted data."""

    id: UUID


def get_current_user(x_development_user: str | None = Header(default=None)) -> CurrentUser:
    """Resolve a development identity without permitting it in production."""
    if os.environ.get("APP_ENV", "development").lower() != "development":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Production authentication is not configured",
        )
    if x_development_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Development-User header is required in development",
        )
    try:
        return CurrentUser(id=UUID(x_development_user))
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Development-User must be a UUID",
        ) from error
