"""
Unit tests for the mobile OAuth flow (approved backend delta).

Covers: mobile state JWT create/decode/validate, PKCE S256 math, mobile
login (JSON + required params), GET relay (minimal delivery hop), POST
callback mobile path (state/PKCE/redirect binding), web regression
isolation, and sensitive-logging absence.

The existing web OAuth flow must remain byte/behavior compatible — see
tests/unit/test_oauth_callback.py and tests/integration/test_oauth_endpoints.py.
"""

import json
import logging
import os
import time
from unittest.mock import Mock, patch

import jwt as pyjwt
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from app.api.v1.oauth import OAuthCallbackRequest
from app.core.oauth_config import (
    OAUTH_MOBILE_REDIRECT_URI,
    compute_pkce_challenge,
    get_oauth_redirect_uri,
    is_valid_code_verifier,
    validate_mobile_oauth_state,
)
from app.core.security import (
    SECRET_KEY,
    ALGORITHM,
    create_oauth_state_token,
    decode_oauth_state_token,
)
from app.models.user import User
from main import app

# RFC 7636 Appendix B test vector
RFC7636_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
RFC7636_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

TEST_MOBILE_REDIRECT_URI = "https://api.test.local/api/v1/oauth/callback/google"


def make_state(provider="google", client="mobile", code_challenge=RFC7636_CHALLENGE, **overrides):
    """Build a valid oauth_state JWT with the same claims as create_oauth_state_token."""
    now = int(time.time())
    payload = {
        "provider": provider,
        "client": client,
        "code_challenge": code_challenge,
        "exp": now + 300,
        "iat": now,
        "nbf": now,
        "jti": "test-jti-123456789012",
        "type": "oauth_state",
        "iss": "grateful-api",
        "aud": "grateful-client",
    }
    payload.update(overrides)
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# Mobile state: create / decode / validate
# ---------------------------------------------------------------------------

class TestOAuthStateToken:
    def test_create_and_decode_roundtrip(self):
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        payload = decode_oauth_state_token(state)
        assert payload["type"] == "oauth_state"
        assert payload["provider"] == "google"
        assert payload["client"] == "mobile"
        assert payload["code_challenge"] == RFC7636_CHALLENGE
        assert payload["iss"] == "grateful-api"
        assert payload["aud"] == "grateful-client"
        assert len(payload["jti"]) >= 16

    def test_create_missing_claims_raises(self):
        with pytest.raises(ValueError):
            create_oauth_state_token("", "mobile", RFC7636_CHALLENGE)
        with pytest.raises(ValueError):
            create_oauth_state_token("google", "", RFC7636_CHALLENGE)
        with pytest.raises(ValueError):
            create_oauth_state_token("google", "mobile", "")

    def test_decode_bad_signature(self):
        state = make_state()
        with patch("app.core.security.SECRET_KEY", "another-secret-key-that-is-32-chars-long!"):
            # encode with a different key
            tampered = pyjwt.encode(
                {"provider": "google"}, "another-secret-key-that-is-32-chars-long!", algorithm=ALGORITHM
            )
        with pytest.raises(pyjwt.InvalidSignatureError):
            decode_oauth_state_token(tampered)

    def test_decode_expired(self):
        state = make_state(exp=int(time.time()) - 60)
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_oauth_state_token(state)

    def test_decode_wrong_type(self):
        state = make_state(type="access")
        with pytest.raises(ValueError, match="oauth_state"):
            decode_oauth_state_token(state)

    def test_decode_missing_required_claim(self):
        state = make_state()
        payload = pyjwt.decode(
            state, SECRET_KEY, algorithms=[ALGORITHM], audience="grateful-client", issuer="grateful-api"
        )
        del payload["code_challenge"]
        missing = pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        with pytest.raises(pyjwt.InvalidTokenError):
            decode_oauth_state_token(missing)

    def test_decode_invalid_issuer(self):
        state = make_state(iss="evil-issuer")
        with pytest.raises(pyjwt.InvalidIssuerError):
            decode_oauth_state_token(state)

    def test_decode_invalid_audience(self):
        state = make_state(aud="evil-audience")
        with pytest.raises(pyjwt.InvalidAudienceError):
            decode_oauth_state_token(state)

    def test_decode_malformed_token(self):
        with pytest.raises(pyjwt.DecodeError):
            decode_oauth_state_token("not-a-jwt")

    def test_decode_short_jti(self):
        state = make_state(jti="short")
        with pytest.raises(ValueError, match="jti"):
            decode_oauth_state_token(state)

    def test_validate_mobile_state_wrong_provider(self):
        state = make_state(provider="google")
        with pytest.raises(ValueError, match="provider"):
            validate_mobile_oauth_state(state, provider="apple")

    def test_validate_mobile_state_wrong_client(self):
        state = make_state(client="web")
        with pytest.raises(ValueError, match="client"):
            validate_mobile_oauth_state(state, provider="google")

    def test_validate_mobile_state_ok(self):
        state = make_state()
        payload = validate_mobile_oauth_state(state, provider="google")
        assert payload["code_challenge"] == RFC7636_CHALLENGE


# ---------------------------------------------------------------------------
# PKCE math
# ---------------------------------------------------------------------------

class TestPkce:
    def test_rfc7636_vector(self):
        assert compute_pkce_challenge(RFC7636_VERIFIER) == RFC7636_CHALLENGE

    def test_challenge_is_unpadded_base64url(self):
        challenge = compute_pkce_challenge(RFC7636_VERIFIER)
        assert "=" not in challenge
        assert "-" in challenge or "_" in challenge  # url-safe alphabet

    def test_different_verifier_different_challenge(self):
        other = compute_pkce_challenge("a" * 64)
        assert other != RFC7636_CHALLENGE

    def test_is_valid_code_verifier(self):
        assert is_valid_code_verifier(RFC7636_VERIFIER)
        assert is_valid_code_verifier("a" * 43)
        assert is_valid_code_verifier("a" * 128)
        assert not is_valid_code_verifier("short")
        assert not is_valid_code_verifier("a" * 200)
        assert not is_valid_code_verifier("a" * 64 + "!")  # invalid char
        assert not is_valid_code_verifier("")
        assert not is_valid_code_verifier(None)


# ---------------------------------------------------------------------------
# Redirect URI derivation
# ---------------------------------------------------------------------------

class TestRedirectUri:
    def test_mobile_uses_configured_env(self):
        assert get_oauth_redirect_uri("google", client="mobile") == OAUTH_MOBILE_REDIRECT_URI

    def test_mobile_default_outside_production(self):
        with patch("app.core.oauth_config.OAUTH_MOBILE_REDIRECT_URI", None):
            with patch("app.core.oauth_config.ENVIRONMENT", "development"):
                uri = get_oauth_redirect_uri("google", client="mobile")
        assert uri == "http://localhost:8000/api/v1/oauth/callback/google"

    def test_mobile_missing_in_production_fails_safe(self):
        with patch("app.core.oauth_config.OAUTH_MOBILE_REDIRECT_URI", None):
            with patch("app.core.oauth_config.ENVIRONMENT", "production"):
                with pytest.raises(ValueError, match="OAUTH_MOBILE_REDIRECT_URI"):
                    get_oauth_redirect_uri("google", client="mobile")

    def test_web_redirect_uri_unchanged(self):
        # Web default remains the frontend URI — no mobile env leakage.
        # Values are pinned independent of the ambient dev .env (a local
        # device session may legitimately override FRONTEND_BASE_URL).
        with patch(
            "app.core.oauth_config.GOOGLE_REDIRECT_URI",
            "http://localhost:3000/auth/callback/google",
        ), patch(
            "app.core.oauth_config.APPLE_REDIRECT_URI",
            "http://localhost:3000/auth/callback/apple",
        ):
            assert get_oauth_redirect_uri("google") == "http://localhost:3000/auth/callback/google"
            assert get_oauth_redirect_uri("apple") == "http://localhost:3000/auth/callback/apple"


# ---------------------------------------------------------------------------
# Endpoint-level tests
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def oauth_env_mocks():
    """Mock app state for OAuth endpoints."""
    config = Mock()
    config.is_provider_available.return_value = True
    config.get_oauth_client.return_value = Mock()
    app.state.oauth_config = config
    app.state.oauth = Mock()
    return config


@pytest_asyncio.fixture
async def client(setup_test_database):
    # NOTE: TestClient is NOT used as a context manager — matching
    # tests/integration/test_oauth_endpoints.py — so the app lifespan (which
    # runs a privacy-drift query against the real engine) never executes and
    # cannot pollute async event loops across tests.
    return TestClient(app)


@pytest.mark.asyncio
async def test_mobile_login_returns_json_authorization_url(client, oauth_env_mocks):
    response = client.get(
        "/api/v1/oauth/login/google",
        params={
            "client": "mobile",
            "code_challenge": RFC7636_CHALLENGE,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert response.status_code == 200
    data = response.json()
    assert "authorization_url" in data
    url = data["authorization_url"]
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    from urllib.parse import parse_qs, urlsplit

    params = parse_qs(urlsplit(url).query)
    assert params["client_id"] == ["test-google-client-id"]
    assert params["code_challenge"] == [RFC7636_CHALLENGE]
    assert params["code_challenge_method"] == ["S256"]
    assert params["redirect_uri"] == [OAUTH_MOBILE_REDIRECT_URI]
    state = params["state"][0]
    assert state.count(".") == 2  # JWT
    payload = decode_oauth_state_token(state)
    assert payload["provider"] == "google"
    assert payload["client"] == "mobile"
    assert payload["code_challenge"] == RFC7636_CHALLENGE


@pytest.mark.asyncio
async def test_mobile_login_missing_challenge_rejected(client, oauth_env_mocks):
    response = client.get(
        "/api/v1/oauth/login/google",
        params={"client": "mobile", "code_challenge_method": "S256"},
    )
    assert response.status_code == 422
    assert "code_challenge" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mobile_login_missing_method_rejected(client, oauth_env_mocks):
    response = client.get(
        "/api/v1/oauth/login/google",
        params={"client": "mobile", "code_challenge": RFC7636_CHALLENGE},
    )
    assert response.status_code == 422
    assert "S256" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mobile_login_plain_method_rejected(client, oauth_env_mocks):
    response = client.get(
        "/api/v1/oauth/login/google",
        params={"client": "mobile", "code_challenge": RFC7636_CHALLENGE, "code_challenge_method": "plain"},
    )
    assert response.status_code == 422
    assert "S256" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mobile_login_invalid_client_rejected(client, oauth_env_mocks):
    response = client.get(
        "/api/v1/oauth/login/google",
        params={"client": "ios", "code_challenge": RFC7636_CHALLENGE, "code_challenge_method": "S256"},
    )
    assert response.status_code == 422
    assert "client" in response.json()["detail"]


@pytest.mark.asyncio
async def test_web_login_remains_redirect_with_web_state(client, oauth_env_mocks):
    response = client.get("/api/v1/oauth/login/google", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers["location"]
    assert "accounts.google.com/o/oauth2/v2/auth" in location
    from urllib.parse import parse_qs, urlsplit

    state = parse_qs(urlsplit(location).query)["state"][0]
    assert state.startswith("google:")
    assert ":" in state  # colon-delimited web state — the discriminator invariant
    assert state.count(".") == 0  # NOT a JWT
    assert "code_challenge" not in parse_qs(urlsplit(location).query)


@pytest.mark.asyncio
async def test_get_relay_is_minimal_delivery_hop(client, oauth_env_mocks):
    state = make_state()
    with patch("httpx.AsyncClient") as mock_client:
        response = client.get(
            "/api/v1/oauth/callback/google",
            params={"code": "auth_code_123", "state": state},
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == (
            f"grateful://oauth/callback?code=auth_code_123&state={state}"
        )
        # The relay must never call the provider token endpoint
        mock_client.assert_not_called()


@pytest.mark.asyncio
async def test_get_relay_forwards_error_params(client, oauth_env_mocks):
    response = client.get(
        "/api/v1/oauth/callback/google",
        params={"error": "access_denied", "error_description": "user said no"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert response.headers["location"] == (
        "grateful://oauth/callback?error=access_denied&error_description=user+said+no"
    )


@pytest.mark.asyncio
async def test_get_relay_uses_configured_scheme(client, oauth_env_mocks):
    with patch("app.core.oauth_config.MOBILE_OAUTH_APP_SCHEME", "myapp"):
        # NOTE: oauth.py imports the module-level constant; patch the endpoint's binding too
        with patch("app.api.v1.oauth.MOBILE_OAUTH_APP_SCHEME", "myapp"):
            response = client.get(
                "/api/v1/oauth/callback/google",
                params={"code": "abc"},
                follow_redirects=False,
            )
            assert response.status_code == 302
            assert response.headers["location"] == "myapp://oauth/callback?code=abc"


@pytest.mark.asyncio
async def test_get_relay_never_authenticates_or_exchanges(client, oauth_env_mocks):
    """The GET relay must never touch OAuthService, issue tokens, or create
    any authenticated state — it is a delivery hop only."""
    state = make_state()
    with patch("app.api.v1.oauth.OAuthService.authenticate_oauth_user") as mock_service:
        mock_service.side_effect = AssertionError("relay must never authenticate")
        with patch("httpx.AsyncClient") as mock_client:
            response = client.get(
                "/api/v1/oauth/callback/google",
                params={"code": "auth_code_123", "state": state},
                follow_redirects=False,
            )
        assert response.status_code == 302
        assert "auth_code_123" in response.headers["location"]
        assert response.headers["location"] == f"grateful://oauth/callback?code=auth_code_123&state={state}"
        mock_service.assert_not_called()
        mock_client.assert_not_called()
        assert "access_token" not in response.text
        assert "refresh_token" not in response.text


@pytest.mark.asyncio
async def test_get_relay_never_validates_state(client, oauth_env_mocks):
    """The relay forwards whatever state it receives — validation is the
    POST endpoint's job, never the GET relay's."""
    with patch("app.api.v1.oauth.validate_oauth_state") as mock_web_validate:
        with patch("app.api.v1.oauth.validate_mobile_oauth_state") as mock_mobile_validate:
            with patch("httpx.AsyncClient") as mock_client:
                response = client.get(
                    "/api/v1/oauth/callback/google",
                    params={"code": "auth_code_123", "state": "garbage_tampered_state"},
                    follow_redirects=False,
                )
            assert response.status_code == 302
            assert response.headers["location"] == (
                "grateful://oauth/callback?code=auth_code_123&state=garbage_tampered_state"
            )
            mock_web_validate.assert_not_called()
            mock_mobile_validate.assert_not_called()
            mock_client.assert_not_called()


@pytest.mark.asyncio
async def test_get_relay_no_params_redirects_to_bare_scheme(client, oauth_env_mocks):
    response = client.get("/api/v1/oauth/callback/google", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"] == "grateful://oauth/callback"


@pytest.mark.asyncio
async def test_get_relay_logs_no_param_values(client, oauth_env_mocks, caplog):
    with caplog.at_level(logging.INFO):
        response = client.get(
            "/api/v1/oauth/callback/google",
            params={"code": "secret_relay_code_42", "state": "secret_relay_state_42"},
            follow_redirects=False,
        )
    assert response.status_code == 302
    all_logs = " ".join(r.getMessage() for r in caplog.records)
    assert "secret_relay_code_42" not in all_logs
    assert "secret_relay_state_42" not in all_logs
    relayed = [getattr(r, "relayed_params", None) for r in caplog.records if hasattr(r, "relayed_params")]
    assert ["code", "state"] in relayed  # param names only, never values


class TestMobileCallback:
    def _mock_exchange(self, success=True, token_data=None):
        mock_response = Mock()
        mock_response.status_code = 200 if success else 400
        mock_response.headers = {"content-type": "application/json"}
        token_data = token_data or {
            "access_token": "mock_access_token_12345",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "mock_refresh_token_67890",
            "scope": "openid email profile",
        }
        mock_response.json.return_value = token_data
        mock_response.text = json.dumps(token_data)
        return mock_response

    def _mock_oauth_user_info(self, oauth_id="google_user_123"):
        return {
            "id": oauth_id,
            "email": "test@example.com",
            "name": "Test User",
            "given_name": "Test",
            "family_name": "User",
            "picture": "https://example.com/photo.jpg",
            "email_verified": True,
            "locale": "en",
        }

    def _successful_callback(self, client, callback_body, capture=None):
        """Run a mobile callback with mocked provider/user-info/service calls."""
        mock_response = self._mock_exchange()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = mock_client.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_response

            with patch("app.services.oauth_service.get_oauth_user_info") as mock_get_info:
                mock_get_info.return_value = self._mock_oauth_user_info()

                response = client.post("/api/v1/oauth/callback/google", json=callback_body)
                if capture is not None:
                    capture["post_call"] = mock_client_instance.post
                return response

    @pytest.mark.asyncio
    async def test_mobile_callback_success_uses_pkce_and_server_redirect(
        self, client, oauth_env_mocks
    ):
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        capture = {}
        response = self._successful_callback(
            client,
            {"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
            capture,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["is_new_user"] is True

        kwargs = capture["post_call"].call_args.kwargs
        sent = kwargs["data"]
        assert sent["code"] == "auth_code_123"
        assert sent["code_verifier"] == RFC7636_VERIFIER
        assert sent["redirect_uri"] == OAUTH_MOBILE_REDIRECT_URI

    @pytest.mark.asyncio
    async def test_mobile_callback_incorrect_verifier_rejected(self, client, oauth_env_mocks):
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state, "code_verifier": "b" * 64},
            )
        assert response.status_code == 400
        assert "Invalid code verifier" in response.json()["detail"]
        # No exchange may be attempted
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_missing_verifier_rejected(self, client, oauth_env_mocks):
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state},
            )
        assert response.status_code == 400
        assert "code_verifier" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_expired_state_rejected(self, client, oauth_env_mocks):
        state = make_state(exp=int(time.time()) - 60)
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_wrong_provider_state_rejected(self, client, oauth_env_mocks):
        state = make_state(provider="apple")
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_wrong_client_state_rejected(self, client, oauth_env_mocks):
        state = make_state(client="web")
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_malformed_state_rejected(self, client, oauth_env_mocks):
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": "garbage.two.dots", "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_bad_signature_rejected(self, client, oauth_env_mocks):
        """A genuine-looking JWT signed with the wrong key must be rejected."""
        tampered = pyjwt.encode(
            {"provider": "google", "client": "mobile", "code_challenge": RFC7636_CHALLENGE},
            "wrong-secret-key-that-is-32-chars-long!!",
            algorithm=ALGORITHM,
        )
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": tampered, "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_invalid_issuer_rejected(self, client, oauth_env_mocks):
        state = make_state(iss="evil-issuer")
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_invalid_audience_rejected(self, client, oauth_env_mocks):
        state = make_state(aud="evil-audience")
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid state parameter" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_tampered_jwt_without_dots_fails_closed(self, client, oauth_env_mocks):
        """A truncated/tampered mobile JWT must NEVER fall through to the web
        path. The web validator is format-agnostic (length-only), so the
        discriminator must route every colon-less state to the strict JWT
        validator, which rejects it."""
        valid = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)

        # Signature segment stripped ("header.payload" — 1 dot, no colon)
        header_payload = valid.rsplit(".", 1)[0]
        # Entire signature+payload dropped — a bare JWT header (no dots, no colon)
        bare_header = valid.split(".", 1)[0]

        for tampered in (header_payload, bare_header, "no-dots-no-colon-16chars"):
            with patch("httpx.AsyncClient") as mock_client:
                with patch("app.api.v1.oauth.validate_oauth_state") as mock_web_validate:
                    mock_web_validate.side_effect = AssertionError(
                        "colon-less state must never be treated as web state"
                    )
                    response = client.post(
                        "/api/v1/oauth/callback/google",
                        json={"code": "auth_code_123", "state": tampered, "code_verifier": RFC7636_VERIFIER},
                    )
            assert response.status_code == 400, f"state {tampered!r} was not rejected"
            assert "Invalid state parameter" in response.json()["detail"]
            mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_mobile_callback_client_supplied_redirect_uri_ignored(
        self, client, oauth_env_mocks
    ):
        """A body redirect_uri / code_challenge must never override server values."""
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        capture = {}
        response = self._successful_callback(
            client,
            {
                "code": "auth_code_123",
                "state": state,
                "code_verifier": RFC7636_VERIFIER,
                "redirect_uri": "https://evil.example.com/callback",
                "code_challenge": "evil_challenge",
            },
            capture,
        )
        assert response.status_code == 200
        kwargs = capture["post_call"].call_args.kwargs
        sent = kwargs["data"]
        assert sent["redirect_uri"] == OAUTH_MOBILE_REDIRECT_URI
        assert sent["code_verifier"] == RFC7636_VERIFIER
        assert "code_challenge" not in sent

    @pytest.mark.asyncio
    async def test_mobile_redirect_uri_used_verbatim_no_normalization(
        self, client, oauth_env_mocks
    ):
        """The exact configured string must flow login → callback → exchange
        with zero normalization (no urljoin, trailing-slash or query surgery).
        The environment-configured value is the contract."""
        dirty_uri = "https://api.test.local/cb?x=1/y="
        with patch("app.core.oauth_config.OAUTH_MOBILE_REDIRECT_URI", dirty_uri):
                login_response = client.get(
                    "/api/v1/oauth/login/google",
                    params={
                        "client": "mobile",
                        "code_challenge": RFC7636_CHALLENGE,
                        "code_challenge_method": "S256",
                    },
                    follow_redirects=False,
                )
                assert login_response.status_code == 200
                from urllib.parse import parse_qs, urlsplit

                auth_params = parse_qs(urlsplit(login_response.json()["authorization_url"]).query)
                assert auth_params["redirect_uri"] == [dirty_uri]

                state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
                capture = {}
                callback_response = self._successful_callback(
                    client,
                    {"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
                    capture,
                )
                assert callback_response.status_code == 200
                sent = capture["post_call"].call_args.kwargs["data"]
                assert sent["redirect_uri"] == dirty_uri

    @pytest.mark.asyncio
    async def test_exchange_exception_logs_status_not_provider_body(
        self, client, oauth_env_mocks, caplog
    ):
        """When the provider exchange fails, the exception must never serialize
        the provider response body into logs."""
        import httpx

        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        request = httpx.Request("POST", "https://oauth2.googleapis.com/token")
        provider_body = '{"error":"invalid_grant","secret_hint":"super_provider_secret_value"}'
        provider_response = httpx.Response(400, text=provider_body, request=request)

        with caplog.at_level(logging.ERROR):
            with patch("httpx.AsyncClient") as mock_client:
                mock_instance = mock_client.return_value.__aenter__.return_value
                mock_instance.post.side_effect = httpx.HTTPStatusError(
                    "400 Client Error", request=request, response=provider_response
                )
                response = client.post(
                    "/api/v1/oauth/callback/google",
                    json={"code": "auth_code_123", "state": state, "code_verifier": RFC7636_VERIFIER},
                )

        assert response.status_code == 500
        all_logs = " ".join(r.getMessage() for r in caplog.records)
        assert "super_provider_secret_value" not in all_logs
        assert provider_body not in all_logs


# ---------------------------------------------------------------------------
# Web regression / isolation
# ---------------------------------------------------------------------------

class TestWebIsolation:
    @pytest.mark.asyncio
    async def test_web_callback_never_routes_through_jwt_validator(self, client, oauth_env_mocks):
        callback_data = {"code": "valid_auth_code", "state": "google:valid_state_12345"}
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
        mock_response.text = json.dumps({"access_token": "mock_token"})

        with patch("app.api.v1.oauth.validate_oauth_state") as mock_validate:
            mock_validate.return_value = True
            with patch("app.api.v1.oauth.validate_mobile_oauth_state") as mock_mobile_validate:
                mock_mobile_validate.side_effect = AssertionError(
                    "web state must never reach the mobile JWT validator"
                )
                with patch("httpx.AsyncClient") as mock_client:
                    mock_client_instance = mock_client.return_value.__aenter__.return_value
                    mock_client_instance.post.return_value = mock_response
                    with patch("app.services.oauth_service.get_oauth_user_info") as mock_get_info:
                        mock_get_info.return_value = {
                            "id": "google_user_123",
                            "email": "test@example.com",
                            "name": "Test User",
                        }
                        response = client.post("/api/v1/oauth/callback/google", json=callback_data)

        assert response.status_code == 200
        mock_validate.assert_called_once()
        mock_mobile_validate.assert_not_called()

    @pytest.mark.asyncio
    async def test_jwt_state_never_accepted_as_web_state(self, client, oauth_env_mocks):
        """A JWT state must take the mobile path (requiring a verifier), not web."""
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        with patch("httpx.AsyncClient") as mock_client:
            response = client.post(
                "/api/v1/oauth/callback/google",
                json={"code": "auth_code_123", "state": state},
            )
        assert response.status_code == 400
        assert "code_verifier" in response.json()["detail"]
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_web_state_never_accepted_as_mobile_state(self, client, oauth_env_mocks):
        """Web-format state + verifier must take the web path (no JWT validation)."""
        callback_data = {
            "code": "valid_auth_code",
            "state": "google:valid_state_12345",
            "code_verifier": RFC7636_VERIFIER,
        }
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
        mock_response.text = json.dumps({"access_token": "mock_token"})

        with patch("app.api.v1.oauth.validate_oauth_state") as mock_validate:
            mock_validate.return_value = True
            with patch("app.api.v1.oauth.validate_mobile_oauth_state") as mock_mobile_validate:
                mock_mobile_validate.side_effect = AssertionError(
                    "web state must never reach the mobile JWT validator"
                )
                with patch("httpx.AsyncClient") as mock_client:
                    mock_client_instance = mock_client.return_value.__aenter__.return_value
                    mock_client_instance.post.return_value = mock_response
                    with patch("app.services.oauth_service.get_oauth_user_info") as mock_get_info:
                        mock_get_info.return_value = {
                            "id": "google_user_123",
                            "email": "test@example.com",
                            "name": "Test User",
                        }
                        response = client.post("/api/v1/oauth/callback/google", json=callback_data)

        assert response.status_code == 200
        mock_validate.assert_called_once()
        mock_mobile_validate.assert_not_called()
        # No code_verifier is sent on the web path
        sent = mock_client_instance.post.call_args.kwargs["data"]
        assert "code_verifier" not in sent

    @pytest.mark.asyncio
    async def test_web_state_with_dots_stays_web_path(self, client, oauth_env_mocks):
        """A web state containing dots (colon present) must take the web path —
        the colon, not dot-count, decides. Token_urlsafe cannot emit dots, but
        the rule must hold for any colon-bearing state."""
        callback_data = {"code": "valid_auth_code", "state": "google:ab.c.de.fghijklmno"}
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
        mock_response.text = json.dumps({"access_token": "mock_token"})

        with patch("app.api.v1.oauth.validate_oauth_state") as mock_validate:
            mock_validate.return_value = True
            with patch("app.api.v1.oauth.validate_mobile_oauth_state") as mock_mobile_validate:
                mock_mobile_validate.side_effect = AssertionError(
                    "colon-bearing state must never reach the mobile JWT validator"
                )
                with patch("httpx.AsyncClient") as mock_client:
                    mock_client_instance = mock_client.return_value.__aenter__.return_value
                    mock_client_instance.post.return_value = mock_response
                    with patch("app.services.oauth_service.get_oauth_user_info") as mock_get_info:
                        mock_get_info.return_value = {
                            "id": "google_user_123",
                            "email": "test@example.com",
                            "name": "Test User",
                        }
                        response = client.post("/api/v1/oauth/callback/google", json=callback_data)

        assert response.status_code == 200
        mock_validate.assert_called_once()
        mock_mobile_validate.assert_not_called()

    @pytest.mark.asyncio
    async def test_web_login_redirect_uri_unchanged(self, client, oauth_env_mocks):
        with patch("app.api.v1.oauth.get_oauth_redirect_uri") as mock_redirect:
            mock_redirect.return_value = "http://localhost:3000/auth/callback/google"
            response = client.get("/api/v1/oauth/login/google", follow_redirects=False)
            assert response.status_code == 307
            mock_redirect.assert_called_once_with("google")  # no client kwarg on web


# ---------------------------------------------------------------------------
# Logging: no sensitive values
# ---------------------------------------------------------------------------

class TestOAuthLogging:
    @pytest.mark.asyncio
    async def test_mobile_callback_logs_no_sensitive_values(self, client, oauth_env_mocks, caplog):
        state = create_oauth_state_token("google", "mobile", RFC7636_CHALLENGE)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"access_token": "mock_access_token_12345", "token_type": "Bearer"}
        mock_response.text = json.dumps({"access_token": "mock_access_token_12345"})

        with caplog.at_level(logging.INFO):
            with patch("httpx.AsyncClient") as mock_client:
                mock_client_instance = mock_client.return_value.__aenter__.return_value
                mock_client_instance.post.return_value = mock_response
                with patch("app.services.oauth_service.get_oauth_user_info") as mock_get_info:
                    mock_get_info.return_value = self_mobile_user_info()
                    response = client.post(
                        "/api/v1/oauth/callback/google",
                        json={"code": "super_secret_auth_code_XYZ", "state": state, "code_verifier": RFC7636_VERIFIER},
                    )

        assert response.status_code == 200
        all_logs = " ".join(r.getMessage() for r in caplog.records)
        assert "super_secret_auth_code_XYZ" not in all_logs
        assert "Code first 10 chars" not in all_logs
        assert "=== OAUTH TOKEN EXCHANGE DEBUG ===" not in all_logs
        assert "Response headers:" not in all_logs
        assert "Response body:" not in all_logs
        assert "Response text" not in all_logs
        assert "test-google-client-secret" not in all_logs
        assert state not in all_logs
        assert "Email field:" not in all_logs
        assert "test@example.com" not in all_logs


    @pytest.mark.asyncio
    async def test_userinfo_debug_log_masks_identity_values(self, caplog):
        """get_oauth_user_info returns real data but its debug diagnostics must
        mask all identity-bearing fields (id, email, names, picture)."""
        from app.core.oauth_config import get_oauth_user_info

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "google_user_123",
            "email": "test@example.com",
            "name": "Test User",
            "given_name": "Test",
            "family_name": "User",
            "picture": "https://example.com/photo_google_user_123.jpg",
            "verified_email": True,
            "locale": "en",
        }
        with caplog.at_level(logging.INFO):
            with patch("app.core.oauth_config.oauth_config") as mock_oauth_config:
                mock_oauth_config.get_oauth_client.return_value = Mock()
                with patch("httpx.AsyncClient") as mock_client:
                    mock_instance = mock_client.return_value.__aenter__.return_value
                    mock_instance.get.return_value = mock_response
                    result = await get_oauth_user_info("google", {"access_token": "mock_token"})

        # Real data is still returned to the caller
        assert result["email"] == "test@example.com"
        assert result["name"] == "Test User"
        # But nothing identity-bearing reaches the logs
        all_logs = " ".join(r.getMessage() for r in caplog.records)
        assert "test@example.com" not in all_logs
        assert "Test User" not in all_logs
        assert "photo_google_user_123.jpg" not in all_logs
        assert "google_user_123" not in all_logs


def self_mobile_user_info():
    return {
        "id": "google_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "given_name": "Test",
        "family_name": "User",
        "picture": "https://example.com/photo.jpg",
        "email_verified": True,
        "locale": "en",
    }
