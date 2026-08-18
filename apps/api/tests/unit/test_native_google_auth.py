"""
Unit tests for SW2-P1 native Google authentication.

Covers: ID-token verification (signature, aud, iss, azp allowlist, exp,
email_verified, sub, nonce binding, fail-closed production allowlist,
development fallback), JWKS caching by kid + rotation refetch, the
token-never-logged discipline, the POST /api/v1/oauth/native/google endpoint
(success, verification failure, provider pipeline reuse, 409 identity
resolutions, 503 not configured), and the additive oauth_user_info parameter
on authenticate_oauth_user (userinfo round-trip skipped when claims are
pre-verified).
"""

import logging
import time
from unittest.mock import AsyncMock, Mock, patch

import jwt as pyjwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core.exceptions import (
    AuthenticationMethodMismatch,
    BusinessLogicError,
    ResurrectionRequired,
    ValidationException,
)
from app.core.oauth_config import GOOGLE_CLIENT_ID
from app.services.google_id_token import (
    GoogleIdTokenError,
    clear_jwks_cache,
    configured_platform_clients,
    verify_google_id_token,
)
from app.services.oauth_service import OAuthService
from main import app

TEST_KID = "test-kid-1234567890"
TEST_ANDROID_CLIENT_ID = "1234567890-abc.apps.googleusercontent.com"
TEST_IOS_CLIENT_ID = "1234567890-def.apps.googleusercontent.com"

DEFAULT_CLAIMS = {
    "sub": "google-user-123",
    "email": "native@example.com",
    "email_verified": True,
    "name": "Native User",
    "given_name": "Native",
    "family_name": "User",
    "picture": "https://example.com/pic.jpg",
    "locale": "en",
}


def make_keypair() -> tuple:
    """Generate an RSA keypair with a JWK-ready public key dict."""
    import json

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(pyjwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    public_jwk["kid"] = TEST_KID
    public_jwk["alg"] = "RS256"
    public_jwk["use"] = "sig"
    return key, public_jwk


def sign_token(
    private_key,
    claims: dict,
    kid: str = TEST_KID,
    aud: str = GOOGLE_CLIENT_ID,
    iss: str = "https://accounts.google.com",
    azp: str = TEST_ANDROID_CLIENT_ID,
    exp_offset: int = 3600,
    iat_offset: int = -60,
    nonce: str = None,
) -> str:
    """Sign a Google-shaped ID token with the test key."""
    now = int(time.time())
    payload = {
        "sub": claims["sub"],
        "email": claims.get("email"),
        "email_verified": claims.get("email_verified", True),
        "name": claims.get("name"),
        "given_name": claims.get("given_name"),
        "family_name": claims.get("family_name"),
        "picture": claims.get("picture"),
        "locale": claims.get("locale"),
        "aud": aud,
        "iss": iss,
        "azp": azp,
        "exp": now + exp_offset,
        "iat": now + iat_offset,
    }
    if nonce is not None:
        payload["nonce"] = nonce
    return pyjwt.encode(payload, private_key, algorithm="RS256", headers={"kid": kid})


@pytest.fixture(autouse=True)
def fresh_jwks_cache():
    """Every test starts with an empty JWKS cache."""
    clear_jwks_cache()
    yield
    clear_jwks_cache()


@pytest.fixture
def jwks_fixture():
    private_key, public_jwk = make_keypair()
    return private_key, {"keys": [public_jwk]}


# ---------------------------------------------------------------------------
# ID-token verification (pure, real cryptography)
# ---------------------------------------------------------------------------

class TestVerifyGoogleIdToken:
    @pytest.mark.asyncio
    async def test_valid_token_normalizes_claims(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS)
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            info = await verify_google_id_token(
                token,
                allowed_azp={TEST_ANDROID_CLIENT_ID},
            )
        assert info["id"] == "google-user-123"
        assert info["email"] == "native@example.com"
        assert info["name"] == "Native User"
        assert info["given_name"] == "Native"
        assert info["family_name"] == "User"
        assert info["picture"] == "https://example.com/pic.jpg"
        assert info["email_verified"] is True
        assert info["locale"] == "en"
        assert info["provider"] == "google"

    @pytest.mark.asyncio
    async def test_bad_signature_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS)
        tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError):
                await verify_google_id_token(tampered, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, exp_offset=-60)
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_wrong_audience_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, aud="evil-client.apps.googleusercontent.com")
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_wrong_issuer_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, iss="https://evil.example.com")
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_azp_not_in_allowlist_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, azp="com.unapproved.app")
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError, match="platform client"):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_missing_azp_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, azp=None)
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError, match="platform client"):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_unverified_email_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, {**DEFAULT_CLAIMS, "email_verified": False})
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError, match="email"):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_missing_sub_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, {**DEFAULT_CLAIMS, "sub": None})
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})

    @pytest.mark.asyncio
    async def test_nonce_mismatch_rejected(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, nonce="expected-nonce")
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with pytest.raises(GoogleIdTokenError, match="nonce"):
                await verify_google_id_token(
                    token, allowed_azp={TEST_ANDROID_CLIENT_ID}, nonce="different-nonce"
                )

    @pytest.mark.asyncio
    async def test_nonce_match_accepted(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, nonce="expected-nonce")
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            info = await verify_google_id_token(
                token, allowed_azp={TEST_ANDROID_CLIENT_ID}, nonce="expected-nonce"
            )
        assert info["id"] == "google-user-123"

    @pytest.mark.asyncio
    async def test_production_empty_allowlist_fails_closed(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS)
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with patch("app.services.google_id_token.ENVIRONMENT", "production"):
                with patch("app.services.google_id_token.GOOGLE_ANDROID_CLIENT_ID", None):
                    with patch("app.services.google_id_token.GOOGLE_IOS_CLIENT_ID", None):
                        with pytest.raises(GoogleIdTokenError, match="allowlist"):
                            await verify_google_id_token(token)

    @pytest.mark.asyncio
    async def test_development_empty_allowlist_accepts_with_warning(self, jwks_fixture, caplog):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS)
        with caplog.at_level(logging.WARNING, logger="app.services.google_id_token"):
            with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
                with patch("app.services.google_id_token.ENVIRONMENT", "development"):
                    with patch("app.services.google_id_token.GOOGLE_ANDROID_CLIENT_ID", None):
                        with patch("app.services.google_id_token.GOOGLE_IOS_CLIENT_ID", None):
                            info = await verify_google_id_token(token)
        assert info["id"] == "google-user-123"
        assert any("allowlist" in record.message for record in caplog.records)

    @pytest.mark.asyncio
    async def test_configured_allowlist_default_used(self, jwks_fixture):
        """With no explicit allowed_azp, the configured platform clients apply."""
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, azp=TEST_ANDROID_CLIENT_ID)
        with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
            with patch("app.services.google_id_token.GOOGLE_ANDROID_CLIENT_ID", TEST_ANDROID_CLIENT_ID):
                with patch("app.services.google_id_token.GOOGLE_IOS_CLIENT_ID", TEST_IOS_CLIENT_ID):
                    assert configured_platform_clients() == {TEST_ANDROID_CLIENT_ID, TEST_IOS_CLIENT_ID}
                    info = await verify_google_id_token(token)
        assert info["id"] == "google-user-123"


# ---------------------------------------------------------------------------
# JWKS caching
# ---------------------------------------------------------------------------

class TestJwksCache:
    @pytest.mark.asyncio
    async def test_cache_hit_does_not_refetch(self, jwks_fixture):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS)
        fetcher = AsyncMock(return_value=jwks)
        with patch("app.services.google_id_token._fetch_jwks", new=fetcher):
            await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})
            await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})
        assert fetcher.await_count == 1

    @pytest.mark.asyncio
    async def test_unknown_kid_triggers_refetch(self, jwks_fixture):
        """A rotated key (new kid) triggers exactly one refetch and works."""
        import json

        private_key, jwks = jwks_fixture
        rotated_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        rotated_jwk = json.loads(pyjwt.algorithms.RSAAlgorithm.to_jwk(rotated_key.public_key()))
        rotated_jwk["kid"] = "rotated-kid-1"
        rotated_jwk["alg"] = "RS256"
        rotated_jwk["use"] = "sig"

        fetcher = AsyncMock(side_effect=[jwks, {"keys": [rotated_jwk]}])
        with patch("app.services.google_id_token._fetch_jwks", new=fetcher):
            old_token = sign_token(private_key, DEFAULT_CLAIMS)
            await verify_google_id_token(old_token, allowed_azp={TEST_ANDROID_CLIENT_ID})
            new_token = sign_token(rotated_key, DEFAULT_CLAIMS, kid="rotated-kid-1")
            info = await verify_google_id_token(new_token, allowed_azp={TEST_ANDROID_CLIENT_ID})
        assert fetcher.await_count == 2
        assert info["id"] == "google-user-123"


# ---------------------------------------------------------------------------
# Token-never-logged discipline
# ---------------------------------------------------------------------------

class TestNoTokenLogging:
    @pytest.mark.asyncio
    async def test_raw_id_token_never_appears_in_logs(self, jwks_fixture, caplog):
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS)
        with caplog.at_level(logging.INFO):
            with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
                await verify_google_id_token(token, allowed_azp={TEST_ANDROID_CLIENT_ID})
        joined = " ".join(record.message for record in caplog.records)
        assert token not in joined
        assert "google-user-123" not in joined


# ---------------------------------------------------------------------------
# POST /api/v1/oauth/native/google
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def oauth_env_mocks():
    """Mock app state for OAuth endpoints (mirrors test_oauth_mobile.py)."""
    config = Mock()
    config.is_provider_available.return_value = True
    config.get_oauth_client.return_value = Mock()
    app.state.oauth_config = config
    app.state.oauth = Mock()
    return config


@pytest_asyncio.fixture
async def client(setup_test_database):
    # NOTE: TestClient is NOT used as a context manager — matching
    # tests/integration/test_oauth_endpoints.py — so the app lifespan never
    # executes and cannot pollute async event loops across tests.
    return TestClient(app)


class TestNativeGoogleEndpoint:
    VERIFIED_CLAIMS = {
        "id": "google-user-123",
        "email": "native@example.com",
        "name": "Native User",
        "given_name": "Native",
        "family_name": "User",
        "picture": "https://example.com/pic.jpg",
        "email_verified": True,
        "locale": "en",
        "provider": "google",
    }

    async def _post(self, client, body):
        return client.post("/api/v1/oauth/native/google", json=body)

    @pytest.mark.asyncio
    async def test_success_returns_canonical_auth_response(self, client, oauth_env_mocks):
        user_data = {
            "user": {"id": 1, "email": "native@example.com", "username": "native"},
            "access_token": "access_token_123",
            "refresh_token": "refresh_token_123",
        }
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(return_value=self.VERIFIED_CLAIMS)) as mock_verify:
            with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user", new=AsyncMock(return_value=(user_data, False))) as mock_service:
                response = await self._post(client, {"id_token": "valid.jwt.token", "nonce": "app-nonce"})

        assert response.status_code == 200
        body = response.json()
        assert body["data"]["user"]["email"] == "native@example.com"
        assert body["data"]["access_token"] == "access_token_123"
        assert body["data"]["refresh_token"] == "refresh_token_123"
        assert body["data"]["is_new_user"] is False
        assert "signup_token" not in body["data"]
        mock_verify.assert_awaited_once_with(
            "valid.jwt.token",
            allowed_azp=configured_platform_clients(),
            nonce="app-nonce",
        )
        # The verified claims must flow into the existing pipeline — the
        # provider userinfo round-trip is skipped (SW2-P1 additive delta).
        mock_service.assert_awaited_once()
        call = mock_service.await_args
        assert call.args[0] == "google"
        assert call.kwargs["oauth_user_info"] == self.VERIFIED_CLAIMS

    @pytest.mark.asyncio
    async def test_new_user_gets_signup_token(self, client, oauth_env_mocks):
        user_data = {
            "user": {"id": 5, "email": "native@example.com", "username": "native"},
            "access_token": "access_token_123",
            "refresh_token": "refresh_token_123",
        }
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(return_value=self.VERIFIED_CLAIMS)):
            with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user", new=AsyncMock(return_value=(user_data, True))):
                response = await self._post(client, {"id_token": "valid.jwt.token"})

        assert response.status_code == 200
        assert response.json()["data"]["is_new_user"] is True
        assert response.json()["data"]["signup_token"]

    @pytest.mark.asyncio
    async def test_verification_failure_returns_401(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(side_effect=GoogleIdTokenError("ID token nonce mismatch"))) as mock_verify:
            with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user") as mock_service:
                response = await self._post(client, {"id_token": "invalid.jwt.token", "nonce": "n"})

        assert response.status_code == 401
        assert response.json()["detail"] == "ID token nonce mismatch"
        mock_verify.assert_awaited_once()
        mock_service.assert_not_called()

    @pytest.mark.asyncio
    async def test_missing_id_token_returns_422(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user") as mock_service:
            response = await self._post(client, {"nonce": "n"})
        assert response.status_code == 422
        mock_service.assert_not_called()

    @pytest.mark.asyncio
    async def test_bad_client_platform_returns_422(self, client, oauth_env_mocks):
        response = await self._post(client, {"id_token": "x", "client_platform": "desktop"})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_auth_method_mismatch_returns_409(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(return_value=self.VERIFIED_CLAIMS)):
            with patch(
                "app.api.v1.oauth.OAuthService.authenticate_oauth_user",
                new=AsyncMock(side_effect=AuthenticationMethodMismatch(
                    code="password_account_exists",
                    message="An account with this email already exists",
                    provider="google",
                )),
            ):
                response = await self._post(client, {"id_token": "valid.jwt.token"})

        assert response.status_code == 409
        body = response.json()
        assert body["type"] == "auth_method_mismatch"
        assert body["code"] == "password_account_exists"

    @pytest.mark.asyncio
    async def test_resurrection_returns_409_with_payload(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(return_value=self.VERIFIED_CLAIMS)):
            with patch(
                "app.api.v1.oauth.OAuthService.authenticate_oauth_user",
                new=AsyncMock(side_effect=ResurrectionRequired(
                    identity_type="oauth",
                    tombstone_user_id=42,
                    provider="google",
                    provider_user_id="google-user-123",
                    oauth_email="native@example.com",
                    oauth_user_info=self.VERIFIED_CLAIMS,
                )),
            ):
                response = await self._post(client, {"id_token": "valid.jwt.token"})

        assert response.status_code == 409
        body = response.json()
        assert "resurrection_available" in body.get("type", "")
        assert body.get("oauth_email") == "native@example.com"

    @pytest.mark.asyncio
    async def test_service_validation_error_returns_422(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(return_value=self.VERIFIED_CLAIMS)):
            with patch(
                "app.api.v1.oauth.OAuthService.authenticate_oauth_user",
                new=AsyncMock(side_effect=ValidationException("Invalid user data from OAuth provider")),
            ):
                response = await self._post(client, {"id_token": "valid.jwt.token"})

        assert response.status_code == 422
        assert response.json()["detail"] == "Invalid user data from OAuth provider"

    @pytest.mark.asyncio
    async def test_service_business_error_returns_400(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.verify_google_id_token", new=AsyncMock(return_value=self.VERIFIED_CLAIMS)):
            with patch(
                "app.api.v1.oauth.OAuthService.authenticate_oauth_user",
                new=AsyncMock(side_effect=BusinessLogicError("Some business constraint")),
            ):
                response = await self._post(client, {"id_token": "valid.jwt.token"})

        assert response.status_code == 400
        assert response.json()["detail"] == "Some business constraint"

    @pytest.mark.asyncio
    async def test_not_configured_returns_503(self, client):
        app.state.oauth_config = None
        app.state.oauth = None
        with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user") as mock_service:
            response = await self._post(client, {"id_token": "valid.jwt.token"})
        assert response.status_code == 503
        mock_service.assert_not_called()

    @pytest.mark.asyncio
    async def test_token_only_logged_as_length(self, client, oauth_env_mocks, caplog, jwks_fixture):
        """The raw ID token must never appear in endpoint logs — length only."""
        private_key, jwks = jwks_fixture
        token = sign_token(private_key, DEFAULT_CLAIMS, nonce="n")
        with caplog.at_level(logging.INFO):
            with patch("app.services.google_id_token._fetch_jwks", new=AsyncMock(return_value=jwks)):
                with patch(
                    "app.api.v1.oauth.configured_platform_clients",
                    return_value={TEST_ANDROID_CLIENT_ID},
                ):
                    with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user", new=AsyncMock(return_value=(
                        {"user": {"id": 1, "email": "native@example.com"}, "access_token": "at", "refresh_token": "rt"},
                        False,
                    ))):
                        response = await self._post(client, {"id_token": token, "nonce": "n"})

        assert response.status_code == 200
        joined = " ".join(record.message for record in caplog.records)
        assert token not in joined


# ---------------------------------------------------------------------------
# authenticate_oauth_user additive oauth_user_info parameter
# ---------------------------------------------------------------------------

class TestAuthenticateWithVerifiedClaims:
    @pytest.mark.asyncio
    async def test_userinfo_roundtrip_skipped_when_claims_supplied(self, db_session):
        """With oauth_user_info provided, the provider userinfo fetch must not
        run — the verified claims are the user info (SW2-P1 additive delta)."""
        service = OAuthService(db_session)
        claims = {
            "id": "google-user-123",
            "email": "native@example.com",
            "name": "Native User",
            "given_name": "Native",
            "family_name": "User",
            "picture": None,
            "email_verified": True,
            "locale": "en",
            "provider": "google",
        }
        token = {"id_token": "valid.jwt.token", "token_type": "id_token"}

        with patch("app.services.oauth_service.get_oauth_user_info", new=AsyncMock(side_effect=AssertionError("must not fetch user info"))) as mock_get_info:
            with patch("app.services.oauth_service.create_access_token", return_value="access_token_123"):
                with patch("app.services.oauth_service.create_refresh_token", return_value="refresh_token_123"):
                    user_data, is_new_user = await service.authenticate_oauth_user(
                        "google", token, oauth_user_info=claims
                    )

        assert is_new_user is True
        assert user_data["user"]["email"] == "native@example.com"
        assert user_data["user"]["oauth_provider"] == "google"
        mock_get_info.assert_not_called()

    @pytest.mark.asyncio
    async def test_existing_user_matches_verified_claims(self, db_session, existing_oauth_user):
        """Same identity via verified claims updates the existing OAuth user."""
        service = OAuthService(db_session)
        claims = {
            "id": existing_oauth_user.oauth_id,
            "email": existing_oauth_user.email,
            "name": "Updated Native Name",
            "given_name": "Updated",
            "family_name": "Name",
            "picture": None,
            "email_verified": True,
            "locale": "en",
            "provider": "google",
        }
        with patch("app.services.oauth_service.get_oauth_user_info", new=AsyncMock(side_effect=AssertionError("must not fetch user info"))):
            with patch("app.services.oauth_service.create_access_token", return_value="access_token_123"):
                with patch("app.services.oauth_service.create_refresh_token", return_value="refresh_token_123"):
                    user_data, is_new_user = await service.authenticate_oauth_user(
                        "google", {"id_token": "t", "token_type": "id_token"}, oauth_user_info=claims
                    )

        assert is_new_user is False
        assert user_data["user"]["id"] == existing_oauth_user.id
        assert user_data["user"]["email"] == existing_oauth_user.email


@pytest_asyncio.fixture
async def existing_oauth_user(db_session):
    """Create an existing OAuth-linked user (mirrors test_oauth_service.py)."""
    from app.models.user import User

    user = User(
        email="native@example.com",
        username="nativeuser",
        display_name="Native User",
        hashed_password="",
        oauth_provider="google",
        oauth_id="google-user-123",
        account_status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user