"""
Canonical resurrection response builders.

These are the SINGLE source of truth for resurrection response shape.
Every route handler that detects resurrection MUST use these builders.

Returns direct dict bodies for JSONResponse(status_code=409, content=...).
NOT exceptions — resurrection is NOT an exception flow.
"""

import secrets
from typing import Optional

from app.core.security import create_resurrection_token


def build_password_resurrection_response() -> dict:
    """Canonical 409 response body for password-based resurrection.

    Both signup and OAuth flows share the same type/code fields.
    Frontend branches on: data.type === "resurrection_available"
    """
    return {
        "type": "resurrection_available",
        "code": "resurrection_available",
        "message": (
            "An account with this email was previously deleted. "
            "You can resurrect it or create a new account."
        ),
    }


def build_oauth_resurrection_response(
    *,
    provider: str,
    provider_user_id: str,
    tombstone_user_id: int,
    oauth_email: Optional[str] = None,
    oauth_user_info: Optional[dict] = None,
) -> dict:
    """Canonical 409 response body for OAuth-based resurrection.

    Generates a resurrection_token (minimal JWT) containing only the
    OAuth identity claims — email and profile data stay in the response
    body and are forwarded by the frontend.
    """
    tombstone_info = {
        "provider": provider,
        "provider_user_id": provider_user_id,
        "tombstone_user_id": tombstone_user_id,
        "nonce": secrets.token_urlsafe(16),
    }
    resurrection_token = create_resurrection_token(tombstone_info)

    return {
        "type": "resurrection_available",
        "code": "resurrection_available",
        "resurrection_token": resurrection_token,
        "tombstone_user_id": tombstone_user_id,
        "provider": provider,
        "oauth_email": oauth_email,
        "oauth_user_info": oauth_user_info,
    }
