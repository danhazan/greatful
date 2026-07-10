"""
Short-lived signed JWT for /welcome eligibility.

Generated during email signup, OAuth signup, and resurrection flows.
Validated by the profile endpoint (computes signup_eligible for route gating).
Cleared after successful onboarding submission.

Unrelated to access/refresh token rotation — signup token is independent.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.core.security import SECRET_KEY, ALGORITHM
from app.config.signup_token_config import SIGNUP_TOKEN_EXPIRE_MINUTES


def create_signup_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "signup",
        "purpose": "signup",
        "exp": now + timedelta(minutes=SIGNUP_TOKEN_EXPIRE_MINUTES),
        "iat": now,
        "nbf": now,
        "jti": str(uuid.uuid4()),
        "iss": "grateful-api",
        "aud": "grateful-client",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_signup_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience="grateful-client",
            issuer="grateful-api",
            options={"require": ["sub", "type", "purpose", "exp", "iat", "jti"]},
        )
        if payload.get("type") != "signup" or payload.get("purpose") != "signup":
            return None
        return payload
    except jwt.PyJWTError:
        return None
