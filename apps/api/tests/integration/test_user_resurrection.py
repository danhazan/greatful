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
