"""
Regression tests: AuthResponseData must include all fields returned by
build_auth_response so FastAPI's response_model doesn't strip them.
"""

from app.core.responses import AuthResponseData, build_auth_response


def test_auth_response_includes_signup_token_for_new_user():
    """build_auth_response(is_new_user=True) must return signup_token."""
    response = build_auth_response(
        user={"id": 1, "username": "test", "email": "test@test.com"},
        access_token="test_access",
        refresh_token="test_refresh",
        is_new_user=True,
    )
    data = response.get("data", {})
    assert "signup_token" in data
    assert isinstance(data["signup_token"], str)
    assert len(data["signup_token"]) > 0


def test_auth_response_serialization_includes_signup_token():
    """AuthResponse model must serialize signup_token when present."""
    payload = {
        "user": {"id": 1, "username": "t", "email": "t@t.com"},
        "access_token": "at",
        "refresh_token": "rt",
        "is_new_user": True,
        "signup_token": "eyJ.test.signature",
    }
    model = AuthResponseData(**payload)
    dumped = model.model_dump()
    assert dumped.get("signup_token") == "eyJ.test.signature"


def test_auth_response_signup_token_is_optional():
    """AuthResponseData must accept is_new_user=False without signup_token."""
    payload = {
        "user": {"id": 2, "username": "existing", "email": "e@e.com"},
        "access_token": "at",
        "refresh_token": "rt",
        "is_new_user": False,
    }
    model = AuthResponseData(**payload)
    dumped = model.model_dump()
    assert "signup_token" in dumped
    assert dumped["signup_token"] is None


def test_build_auth_response_existing_user_no_signup_token():
    """build_auth_response(is_new_user=False) must not include signup_token."""
    response = build_auth_response(
        user={"id": 2, "username": "existing", "email": "e@e.com"},
        access_token="test_access",
        refresh_token="test_refresh",
        is_new_user=False,
    )
    data = response.get("data", {})
    assert "signup_token" not in data
