"""
Google ID-token verification for SW2-P1 native authentication.

Verifies OpenID Connect ID tokens minted by the native Google Sign-In flow
(Android first, iOS in SW2-P4) against Google's public JWKS, binds them to
the server-side Web client ID (``aud``) and the platform-client allowlist
(``azp``), and normalizes the verified claims into the OAuthService user-info
contract so the existing OAuth pipeline can consume them without a provider
round-trip (no access token, no userinfo fetch).

Security invariants:
  - The raw ID token is NEVER logged — only a length marker.
  - JWKS keys are cached by key id (kid) with a bounded TTL; an unknown kid
    triggers a refetch (key rotation). The whole (tiny) key set is refreshed
    on miss; the cache is cleared atomically after a successful fetch.
  - ``aud`` must equal GOOGLE_CLIENT_ID (Web client); ``azp`` must be in the
    configured platform allowlist. Both use exact string matching. Production
    fails closed when the allowlist is empty; development logs a warning.
  - ``email_verified`` must be exactly true; ``sub`` (the stable Google user
    id) is required.
  - When a ``nonce`` is supplied it must equal the token's ``nonce`` claim
    (constant-time comparison). The native client generates one nonce per
    ``configure()`` call (per app process) and sends it in the request body —
    see AUTH_MOBILE_ARCHITECTURE.md §15.
"""

import hmac
import logging
import time
from typing import Any, Dict, Optional, Set, Tuple

import httpx
import jwt

from app.core.oauth_config import (
    ENVIRONMENT,
    GOOGLE_ANDROID_CLIENT_ID,
    GOOGLE_CLIENT_ID,
    GOOGLE_ID_TOKEN_ISSUERS,
    GOOGLE_ID_TOKEN_JWKS_CACHE_TTL_SECONDS,
    GOOGLE_ID_TOKEN_JWKS_URL,
    GOOGLE_IOS_CLIENT_ID,
)

logger = logging.getLogger(__name__)

# kid -> (JWK dict, monotonic fetched_at). Bounded by design: Google's cert set
# is tiny and refreshed whole on miss.
_jwks_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}


class GoogleIdTokenError(Exception):
    """Raised when an ID token fails verification. Message is client-safe."""


def configured_platform_clients() -> Set[str]:
    """The server-side ``azp`` allowlist (configured platform client IDs)."""
    return {cid for cid in (GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID) if cid}


def _signing_key_from_jwk(jwk: Dict[str, Any]) -> Any:
    """Build a PyJWT RSA key object from a JWK dict (requires cryptography)."""
    return jwt.algorithms.RSAAlgorithm.from_jwk(jwk)


async def _fetch_jwks() -> Dict[str, Any]:
    """Fetch Google's current JWKS. Raises httpx.HTTPError on failure."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(GOOGLE_ID_TOKEN_JWKS_URL)
        response.raise_for_status()
        return response.json()


def _cache_sign_keys(jwks: Dict[str, Any], fetched_at: float) -> None:
    """Replace the whole key cache from a JWKS payload (atomic after success)."""
    _jwks_cache.clear()
    for key in jwks.get("keys", []):
        kid = key.get("kid")
        if kid:
            _jwks_cache[kid] = (key, fetched_at)


async def _get_signing_key(kid: str) -> Any:
    """Return the cached key for ``kid``, refetching the JWKS on miss/rotation.

    A failed refetch for an unknown kid is fatal (the token cannot be verified);
    a failed refetch for a known, still-fresh kid keeps the cached key usable.
    """
    now = time.monotonic()
    cached = _jwks_cache.get(kid)
    if cached and now - cached[1] < GOOGLE_ID_TOKEN_JWKS_CACHE_TTL_SECONDS:
        return _signing_key_from_jwk(cached[0])
    try:
        _cache_sign_keys(await _fetch_jwks(), time.monotonic())
    except httpx.HTTPError:
        if cached:
            logger.warning("JWKS refetch failed; using cached key for kid %s", kid)
            return _signing_key_from_jwk(cached[0])
        raise
    fresh = _jwks_cache.get(kid)
    if not fresh:
        raise GoogleIdTokenError("Unable to verify ID token signature")
    return _signing_key_from_jwk(fresh[0])


def _fail(message: str) -> GoogleIdTokenError:
    logger.info("Google ID-token verification failed: %s", message)
    return GoogleIdTokenError(message)


async def verify_google_id_token(
    id_token: str,
    *,
    allowed_azp: Optional[Set[str]] = None,
    nonce: Optional[str] = None,
) -> Dict[str, Any]:
    """Verify a Google ID token and return normalized user info claims.

    Args:
        id_token: The OpenID Connect ID token from the native sign-in flow.
        allowed_azp: Optional explicit platform allowlist; defaults to the
            configured ANDROID/IOS Google client IDs.
        nonce: The nonce the app generated at ``configure()`` time. When
            provided, the token's ``nonce`` claim must match exactly.

    Returns:
        Normalized user-info dict matching ``get_oauth_user_info``'s Google
        shape: id, email, name, given_name, family_name, picture,
        email_verified, locale, provider.

    Raises:
        GoogleIdTokenError: on any verification failure (message is safe to
            surface to the client as a 401 detail).
    """
    if not GOOGLE_CLIENT_ID:
        raise _fail("Google OAuth is not configured")

    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.PyJWTError:
        raise _fail("Invalid ID token format")

    kid = header.get("kid")
    if not kid or header.get("alg") != "RS256":
        raise _fail("Invalid ID token format")

    try:
        key = await _get_signing_key(kid)
    except (httpx.HTTPError, GoogleIdTokenError) as exc:
        if isinstance(exc, GoogleIdTokenError):
            raise
        raise _fail("Unable to verify ID token signature") from exc

    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=GOOGLE_CLIENT_ID,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_exp": True,
                "verify_iat": True,
                "require": ["sub", "aud", "iss", "exp", "iat"],
            },
        )
    except jwt.InvalidTokenError:
        raise _fail("Invalid ID token")

    # PyJWT < 2.10 supports only a single issuer string, so the multi-form
    # Google issuer check is done explicitly (exact match against the
    # configured issuer tuple).
    if claims.get("iss") not in GOOGLE_ID_TOKEN_ISSUERS:
        raise _fail("Invalid ID token issuer")

    # Platform binding: the client that minted the token must be allowlisted.
    platform_allowlist = allowed_azp or configured_platform_clients()
    if platform_allowlist:
        azp = claims.get("azp")
        if not azp or azp not in platform_allowlist:
            raise _fail("ID token was not issued to an approved platform client")
    elif ENVIRONMENT == "production":
        raise _fail("Platform client allowlist is not configured")
    else:
        logger.warning(
            "Google ID-token azp allowlist not configured; "
            "accepting any platform client (development only)"
        )

    if claims.get("email_verified") is not True:
        raise _fail("Google account email is not verified")

    if nonce is not None:
        claim_nonce = claims.get("nonce")
        if not claim_nonce or not hmac.compare_digest(
            str(claim_nonce), str(nonce)
        ):
            raise _fail("ID token nonce mismatch")

    return {
        "id": claims["sub"],
        "email": claims.get("email"),
        "name": claims.get("name"),
        "given_name": claims.get("given_name"),
        "family_name": claims.get("family_name"),
        "picture": claims.get("picture"),
        "email_verified": True,
        "locale": claims.get("locale"),
        "provider": "google",
    }


def clear_jwks_cache() -> None:
    """Clear the JWKS cache (test support)."""
    _jwks_cache.clear()
