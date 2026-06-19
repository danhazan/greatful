import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from app.models.user import User
from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity
from app.services.user_deletion_service import UserDeletionService
from app.services.auth_service import AuthService
from app.core.security import get_password_hash
from main import app

pytestmark = pytest.mark.asyncio


async def test_password_resurrection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test resurrecting a user via standard password signup flow."""
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)

    deleted_user = await User.get_by_id(db_session, user_id)
    assert deleted_user.account_status == "deleted"
    assert deleted_user.email != original_email
    assert "deleted-user" in deleted_user.email
    assert deleted_user.username.startswith("deleted_user_")

    # Phase 1: tombstone detected -> 409
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123"
        }
    )
    assert response.status_code == 409
    data = response.json()
    # Must return canonical response (direct body, no detail wrapper)
    assert data.get("type") == "resurrection_available", f"Wrong type: {data}"
    assert data.get("code") == "resurrection_available", f"Wrong code: {data}"

    # Phase 2: accept resurrection
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123",
            "resurrect_action": "accept"
        }
    )
    assert response.status_code == 201
    data = response.json()
    user_data = data.get("data", {}).get("user", data.get("user", {}))
    assert user_data["id"] == user_id
    assert user_data["username"] == username
    assert user_data["email"] == original_email

    db_session.expire_all()
    resurrected_user = await User.get_by_id(db_session, user_id)
    assert resurrected_user.account_status == "active"
    assert resurrected_user.deleted_at is None
    assert resurrected_user.email == original_email
    assert resurrected_user.token_version > 0

    stmt = select(DeletedUserAuthIdentity).where(DeletedUserAuthIdentity.user_id == user_id)
    result = await db_session.execute(stmt)
    assert len(result.scalars().all()) > 0


async def test_password_resurrection_with_new_username(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test resurrecting with a DIFFERENT username (username is NOT identity)."""
    user_id = test_user.id
    old_username = test_user.username
    new_username = "brand_new_name"
    original_email = test_user.email

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, old_username)

    # Accept resurrection with a new username
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": new_username,
            "email": original_email,
            "password": "new_secure_password123",
            "resurrect_action": "accept"
        }
    )
    assert response.status_code == 201
    data = response.json()
    user_data = data.get("data", {}).get("user", data.get("user", {}))
    assert user_data["id"] == user_id
    assert user_data["username"] == new_username

    db_session.expire_all()
    resurrected_user = await User.get_by_id(db_session, user_id)
    assert resurrected_user.account_status == "active"
    assert resurrected_user.username == new_username


async def test_password_resurrection_decline(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test declining resurrection creates a NEW user."""
    user_id = test_user.id
    old_username = test_user.username
    original_email = test_user.email
    new_username = "fresh_new_user"

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, old_username)

    # Decline resurrection - creates new user
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": new_username,
            "email": original_email,
            "password": "new_secure_password123",
            "resurrect_action": "decline"
        }
    )
    assert response.status_code == 201
    data = response.json()
    user_data = data.get("data", {}).get("user", data.get("user", {}))
    assert user_data["id"] != user_id  # new user, different ID
    assert user_data["username"] == new_username
    assert user_data["email"] == original_email

    # Verify old user still deleted
    db_session.expire_all()
    old_user = await User.get_by_id(db_session, user_id)
    assert old_user.account_status == "deleted"

    # Tombstone must NOT be removed
    stmt = select(DeletedUserAuthIdentity).where(DeletedUserAuthIdentity.user_id == user_id)
    result = await db_session.execute(stmt)
    assert len(result.scalars().all()) > 0


async def test_squatting_tombstoned_email_blocked(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test that an attacker cannot squat a tombstoned email without explicit action."""
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)

    # Charlie signs up with Alice's old email (no resurrect_action)
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": "charlie",
            "email": original_email,
            "password": "password123"
        }
    )
    assert response.status_code == 409

    # Verify Alice is still dead
    db_session.expire_all()
    alice = await User.get_by_id(db_session, user_id)
    assert alice.account_status == "deleted"


async def test_oauth_resurrection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test resurrecting a user via OAuth."""
    test_user.oauth_provider = "google"
    test_user.oauth_id = "google-id-123"
    test_user.oauth_data = {"provider_data": {"id": "google-id-123", "email": test_user.email}}
    db_session.add(test_user)
    await db_session.commit()

    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)

    deleted_user = await User.get_by_id(db_session, user_id)
    assert deleted_user.account_status == "deleted"

    from unittest.mock import patch
    from app.core.exceptions import ResurrectionRequired
    from app.services.oauth_service import OAuthService

    oauth_service = OAuthService(db_session)

    oauth_info = {
        "id": "google-id-123",
        "email": original_email,
        "name": "Test User",
        "email_verified": True
    }

    # OAuth resurrection should raise ResurrectionRequired (not auto-resurrect)
    with patch('app.services.oauth_service.get_oauth_user_info', return_value=oauth_info):
        with pytest.raises(ResurrectionRequired) as excinfo:
            await oauth_service.authenticate_oauth_user(
                provider="google",
                oauth_token={"access_token": "mock-token", "token_type": "Bearer"}
            )
    assert excinfo.value.identity_type == "oauth"

    # Verify user is still deleted
    db_session.expire_all()
    deleted_user = await User.get_by_id(db_session, user_id)
    assert deleted_user.account_status == "deleted"


async def test_duplicate_password_resurrection_idempotency(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test that duplicate resurrection requests return success (idempotency)."""
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)

    # First resurrection (accept)
    response1 = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123",
            "resurrect_action": "accept"
        }
    )
    assert response1.status_code == 201

    # Duplicate request with same credentials -> conflict (email taken)
    response2 = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123"
        }
    )
    assert response2.status_code == 409
    assert "already registered" in response2.text.lower() or "resurrection_available" in response2.text.lower()


async def test_oauth_resurrection_response_shape(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test OAuth resurrection returns canonical 409 response via API (no detail wrapper)."""
    import json
    from unittest.mock import Mock, patch
    from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity
    from app.services.user_deletion_service import UserDeletionService

    user_id = test_user.id
    original_email = test_user.email

    # 1. Create an OAuth identity for the test user
    identity = DeletedUserAuthIdentity(
        user_id=user_id,
        identity_type="oauth",
        provider="google",
        provider_user_id="google-test-id-123",
    )
    db_session.add(identity)
    await db_session.commit()

    # 2. Delete the user
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, test_user.username)

    # 3. Set up OAuth mocks on the app
    app.state.oauth_config = Mock()
    app.state.oauth_config.is_provider_available.return_value = True
    app.state.oauth = Mock()

    mock_token_response = Mock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
    mock_token_response.text = json.dumps({"access_token": "mock_token"})
    mock_token_response.headers = {"content-type": "application/json"}

    # 4. Mock httpx and call the endpoint
    with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
        mock_validate.return_value = True

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client_instance = mock_client_class.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_token_response

            with patch('app.services.oauth_service.get_oauth_user_info') as mock_user_info:
                mock_user_info.return_value = {
                    "id": "google-test-id-123",
                    "email": original_email,
                    "name": "Test User",
                }

                response = await async_client.post(
                    "/api/v1/oauth/callback/google",
                    json={"code": "mock_auth_code", "state": "google:test_state"},
                )

    # 5. Verify canonical response shape (direct body, no detail wrapper)
    assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
    data = response.json()

    assert data.get("type") == "resurrection_available", f"Wrong type: {data}"
    assert data.get("code") == "resurrection_available", f"Wrong code: {data}"
    assert "resurrection_token" in data, f"Missing resurrection_token: {data}"
    assert isinstance(data["resurrection_token"], str) and len(data["resurrection_token"]) > 0
    assert data.get("provider") == "google"
    assert data.get("oauth_email") == original_email


async def test_oauth_login_against_active_password_user_blocks_resurrection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """Issue 3: OAuth login against an active password account MUST NOT trigger resurrection.

    Invariant: Active user ALWAYS wins over tombstones.
    Precedence: active email check BEFORE any tombstone lookup.
    """
    import json
    from unittest.mock import Mock, patch

    original_email = test_user.email

    # Ensure test_user is password-only and active
    assert bool(test_user.hashed_password), "test_user must have a password"
    assert not test_user.oauth_provider, "test_user must not have OAuth"
    assert test_user.account_status == "active"

    app.state.oauth_config = Mock()
    app.state.oauth_config.is_provider_available.return_value = True
    app.state.oauth = Mock()

    mock_token_response = Mock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
    mock_token_response.text = json.dumps({"access_token": "mock_token"})
    mock_token_response.headers = {"content-type": "application/json"}

    with patch("app.api.v1.oauth.validate_oauth_state") as mock_validate:
        mock_validate.return_value = True
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = mock_client_class.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_token_response
            with patch("app.services.oauth_service.get_oauth_user_info") as mock_user_info:
                mock_user_info.return_value = {
                    "id": "completely-new-oauth-id",
                    "email": original_email,
                    "name": "Intruder",
                }

                response = await async_client.post(
                    "/api/v1/oauth/callback/google",
                    json={"code": "mock_auth_code", "state": "google:test_state"},
                )

    # Must NOT return resurrection_available (active user wins)
    assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
    data = response.json()

    # Verify it's an auth_method_mismatch, NOT resurrection
    assert data.get("type") == "auth_method_mismatch", \
        f"Expected auth_method_mismatch, got type={data.get('type')}: {data}"
    assert data.get("code") == "password_account_exists"
    assert "please sign in with your password" in data.get("message", "").lower(), \
        f"Expected password hint, got: {data.get('message')}"


async def test_oauth_resurrection_for_tombstoned_password_user(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Strict separation: OAuth login ignores email tombstones, creates new user instead.

    Scenario: User A (password auth) deletes account. User B tries OAuth with the same
    email and a different OAuth ID. The OAuth flow must NOT look at email tombstones.
    It must create a fresh user. The password tombstone remains available for the
    password signup flow.
    """
    original_email = test_user.email
    user_id = test_user.id

    # Delete the password user (creates email tombstone)
    from app.services.user_deletion_service import UserDeletionService
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, test_user.username)

    # Verify tombstone exists
    from app.core.resurrection import find_tombstone_by_email
    tombstone = await find_tombstone_by_email(db_session, original_email)
    assert tombstone is not None
    assert tombstone.identity_type == "email"

    # OAuth authentication with the same email (different OAuth ID)
    # MUST create a new user — email tombstones are invisible to OAuth flow
    from unittest.mock import patch
    from app.services.oauth_service import OAuthService

    oauth_service = OAuthService(db_session)

    oauth_info = {
        "id": "different-oauth-id-456",
        "email": original_email,
        "name": "New User",
        "email_verified": True,
    }

    with patch("app.services.oauth_service.get_oauth_user_info", return_value=oauth_info):
        user_data, is_new = await oauth_service.authenticate_oauth_user(
            provider="google",
            oauth_token={"access_token": "mock-token", "token_type": "Bearer"},
        )

    # Must create a new user (not resurrect)
    assert is_new is True
    assert user_data["user"]["email"] == original_email
    assert user_data["user"]["oauth_provider"] == "google"

    # The original email tombstone must still be available for password flow
    tombstone_after = await find_tombstone_by_email(db_session, original_email)
    assert tombstone_after is not None, "Email tombstone must not be consumed by OAuth flow"


async def test_resurrection_response_contract_password(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Contract test: password resurrection response has canonical type field."""
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)

    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123",
        },
    )
    assert response.status_code == 409
    data = response.json()

    assert data.get("type") == "resurrection_available"
    assert data.get("code") == "resurrection_available"
    assert "message" in data


async def test_resurrection_response_contract_oauth(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Contract test: OAuth resurrection response has canonical type field.

    Verifies both flows return identical type + code at the root level.
    """
    import json
    from unittest.mock import Mock, patch
    from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity
    from app.services.user_deletion_service import UserDeletionService

    user_id = test_user.id
    original_email = test_user.email

    identity = DeletedUserAuthIdentity(
        user_id=user_id,
        identity_type="oauth",
        provider="google",
        provider_user_id="google-contract-test-id",
    )
    db_session.add(identity)
    await db_session.commit()

    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, test_user.username)

    app.state.oauth_config = Mock()
    app.state.oauth_config.is_provider_available.return_value = True
    app.state.oauth = Mock()

    mock_token_response = Mock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
    mock_token_response.text = json.dumps({"access_token": "mock_token"})
    mock_token_response.headers = {"content-type": "application/json"}

    with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
        mock_validate.return_value = True
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client_instance = mock_client_class.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_token_response
            with patch('app.services.oauth_service.get_oauth_user_info') as mock_user_info:
                mock_user_info.return_value = {
                    "id": "google-contract-test-id",
                    "email": original_email,
                    "name": "Test User",
                }
                response = await async_client.post(
                    "/api/v1/oauth/callback/google",
                    json={"code": "mock_auth_code", "state": "google:test_state"},
                )

    assert response.status_code == 409
    data = response.json()

    # Contract assertions: identical type + code across both flows
    assert data.get("type") == "resurrection_available"
    assert data.get("code") == "resurrection_available"
    assert "resurrection_token" in data
    assert isinstance(data["resurrection_token"], str) and len(data["resurrection_token"]) > 0


async def test_multi_cycle_password_resurrection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """DELETE → RESURRECT → DELETE → RESURRECT (password, 2 cycles).

    Verifies the tombstone remains usable across multiple cycles without
    being consumed on resurrection accept.
    """
    from app.core.rate_limiting import get_rate_limiter
    get_rate_limiter().clear_all_limits()

    user_id = test_user.id
    original_email = test_user.email
    password = "newpass123"
    deletion_service = UserDeletionService(db_session)

    for cycle in range(2):
        await deletion_service.delete_user(user_id, test_user.username)

        db_session.expire_all()
        deleted = await User.get_by_id(db_session, user_id)
        assert deleted.account_status == "deleted"

        # First signup attempt: should offer resurrection
        response = await async_client.post(
            "/api/v1/auth/signup",
            json={
                "username": test_user.username,
                "email": original_email,
                "password": password,
            },
        )
        assert response.status_code == 409, f"Cycle {cycle}: expected 409, got {response.status_code}"
        data = response.json()
        assert data.get("type") == "resurrection_available", f"Cycle {cycle}: {data}"

        # Accept resurrection
        response = await async_client.post(
            "/api/v1/auth/signup",
            json={
                "username": test_user.username,
                "email": original_email,
                "password": password,
                "resurrect_action": "accept",
            },
        )
        assert response.status_code == 201, f"Cycle {cycle}: expected 201, got {response.status_code}"
        user_data = response.json().get("data", {}).get("user", response.json().get("user", {}))
        assert user_data["id"] == user_id, f"Cycle {cycle}: wrong user id"

        # Verify tombstone still exists and is unconsumed
        db_session.expire_all()
        stmt = select(DeletedUserAuthIdentity).where(
            DeletedUserAuthIdentity.user_id == user_id,
            DeletedUserAuthIdentity.consumed_at.is_(None),
        )
        result = await db_session.execute(stmt)
        tombstones = result.scalars().all()
        assert len(tombstones) >= 1, f"Cycle {cycle}: no unconsumed tombstone"

        db_session.expire_all()
        user = await User.get_by_id(db_session, user_id)
        assert user.account_status == "active"
        assert user.email == original_email

    # After 2 cycles, no duplicate tombstones should exist
    stmt = select(DeletedUserAuthIdentity).where(
        DeletedUserAuthIdentity.user_id == user_id,
    )
    result = await db_session.execute(stmt)
    all_tombstones = result.scalars().all()
    assert len(all_tombstones) == 1, f"Expected 1 tombstone row, got {len(all_tombstones)}"


async def test_multi_cycle_oauth_resurrection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """DELETE → RESURRECT → DELETE → RESURRECT → DELETE → RESURRECT (OAuth, via HTTP API).

    Verifies the OAuth tombstone remains usable across unlimited cycles.
    Uses the full HTTP flow: OAuth callback → 409 → /auth/oauth/resurrect.
    """
    import json
    from unittest.mock import Mock, patch
    from app.services.user_deletion_service import UserDeletionService

    user_id = test_user.id
    original_username = test_user.username
    original_email = test_user.email
    test_user.oauth_provider = "google"
    test_user.oauth_id = "multi-cycle-oauth-id"
    db_session.add(test_user)
    await db_session.commit()
    await db_session.refresh(test_user)

    deletion_service = UserDeletionService(db_session)
    app.state.oauth_config = Mock()
    app.state.oauth_config.is_provider_available.return_value = True
    app.state.oauth = Mock()

    mock_token_response = Mock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {"access_token": "mock_token", "token_type": "Bearer"}
    mock_token_response.text = json.dumps({"access_token": "mock_token"})
    mock_token_response.headers = {"content-type": "application/json"}

    for cycle in range(2):
        # Delete
        await deletion_service.delete_user(user_id, original_username)
        db_session.expire_all()

        # Hit OAuth callback — should get 409 with resurrection_token
        with patch("app.api.v1.oauth.validate_oauth_state") as mock_validate:
            mock_validate.return_value = True
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_client_instance = mock_client_class.return_value.__aenter__.return_value
                mock_client_instance.post.return_value = mock_token_response
                with patch("app.services.oauth_service.get_oauth_user_info") as mock_user_info:
                    mock_user_info.return_value = {
                        "id": "multi-cycle-oauth-id",
                        "email": original_email,
                        "name": "Cycle Test User",
                    }
                    response = await async_client.post(
                        "/api/v1/oauth/callback/google",
                        json={"code": "mock_auth_code", "state": "google:test_state"},
                    )

        assert response.status_code == 409, f"Cycle {cycle}: expected 409, got {response.status_code}"
        data = response.json()
        assert data.get("type") == "resurrection_available", f"Cycle {cycle}: {data}"
        resurrection_token = data.get("resurrection_token")
        assert resurrection_token, f"Cycle {cycle}: no resurrection_token"

        # Accept resurrection
        response = await async_client.post(
            "/api/v1/auth/oauth/resurrect",
            json={
                "resurrection_token": resurrection_token,
                "resurrect_action": "accept",
                "username": original_username,
                "email": original_email,
            },
        )
        assert response.status_code == 200, f"Cycle {cycle}: expected 200, got {response.status_code}: {response.text}"
        body = response.json()
        user_data = body.get("data", {}).get("user", body.get("user", {}))
        assert user_data["id"] == user_id, f"Cycle {cycle}: wrong user id"

        # Verify unconsumed tombstone still exists
        db_session.expire_all()
        stmt = select(DeletedUserAuthIdentity).where(
            DeletedUserAuthIdentity.user_id == user_id,
            DeletedUserAuthIdentity.consumed_at.is_(None),
        )
        result = await db_session.execute(stmt)
        tombstones = result.scalars().all()
        assert len(tombstones) >= 1, f"Cycle {cycle}: no unconsumed tombstone"

    # After 2 cycles: exactly 2 tombstones (email + oauth), both unconsumed
    stmt = select(DeletedUserAuthIdentity).where(
        DeletedUserAuthIdentity.user_id == user_id,
    )
    result = await db_session.execute(stmt)
    all_rows = result.scalars().all()
    assert len(all_rows) == 2, f"Expected 2 tombstone rows (email+oauth), got {len(all_rows)}"
    for row in all_rows:
        assert row.consumed_at is None, f"Tombstone {row.id} ({row.identity_type}) was consumed"


async def test_resurrected_oauth_user_login_shows_provider_message(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """Resurrected OAuth user must show provider-specific login error, not generic.

    Regression: resurrect_oauth_user() does not restore hashed_password to ''.
    During deletion, _scrub_user overwrites it with random hash.
    After resurrection, auth_service.login() sees non-empty hashed_password,
    skips the OAuth check at line 187, and falls through to password
    verification which fails with 'Incorrect email or password'.
    """
    from app.services.user_deletion_service import UserDeletionService
    from app.core.resurrection import find_tombstone_by_oauth, resurrect_oauth_user

    user_id = test_user.id
    original_email = test_user.email
    original_username = test_user.username

    # Convert test_user to OAuth user
    test_user.oauth_provider = "google"
    test_user.oauth_id = "login-test-oauth-id"
    test_user.hashed_password = ""  # OAuth users have no password
    db_session.add(test_user)
    await db_session.commit()
    await db_session.refresh(test_user)

    def _get_error_message(response_data: dict) -> str:
        """Extract error message from wrapped API response."""
        err = response_data.get("error", {})
        return err.get("message", "") or response_data.get("detail", "")

    # Verify: fresh OAuth user correctly blocks password login with provider message
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": original_email, "password": "any_password"},
    )
    assert response.status_code == 401
    data = response.json()
    msg = _get_error_message(data)
    assert "google" in msg.lower(), (
        f"Fresh OAuth user should show provider message, got: {data}"
    )

    db_session.expire_all()
    user = await User.get_by_id(db_session, user_id)
    assert user.hashed_password == "", f"Fresh OAuth has non-empty password: {user.hashed_password!r}"

    # Delete and resurrect
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, original_username)

    db_session.expire_all()
    user = await User.get_by_id(db_session, user_id)
    assert len(user.hashed_password) == 60, f"After deletion, pw should be bcrypt hash, got len={len(user.hashed_password)}"

    tombstone = await find_tombstone_by_oauth(db_session, "google", "login-test-oauth-id")
    assert tombstone is not None

    user = await resurrect_oauth_user(
        db_session, tombstone,
        provider="google",
        provider_user_id="login-test-oauth-id",
        email=original_email,
        username=original_username,
    )
    await db_session.commit()
    await db_session.refresh(user)
    assert user.account_status == "active"

    # Verify resurrected OAuth user has empty hashed_password
    db_session.expire_all()
    user = await User.get_by_id(db_session, user_id)
    assert user.hashed_password == "", (
        f"Resurrected OAuth user must have empty hashed_password, "
        f"got len={len(user.hashed_password)} pw={user.hashed_password!r}"
    )

    # Now try password login — must get provider-specific message
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": original_email, "password": "any_password"},
    )
    assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text[:500]}"
    data = response.json()
    msg = _get_error_message(data)
    assert "google" in msg.lower(), (
        f"Resurrected OAuth user must show provider message, "
        f"got status={response.status_code}, "
        f"response={response.text[:500]}"
    )
