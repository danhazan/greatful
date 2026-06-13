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

pytestmark = pytest.mark.asyncio

async def test_password_resurrection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test resurrecting a user via standard password signup flow."""
    # First, tombstone the user
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email
    
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)
    
    # Verify user is deleted
    deleted_user = await User.get_by_id(db_session, user_id)
    assert deleted_user.account_status == "deleted"
    assert deleted_user.email != original_email
    assert "deleted-user" in deleted_user.email
    
    # Now attempt to resurrect
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    user_data = data.get("data", {}).get("user", data.get("user", {}))
    assert user_data["id"] == user_id
    assert user_data["username"] == username
    assert user_data["email"] == original_email
    
    # Verify db state
    db_session.expire_all()
    resurrected_user = await User.get_by_id(db_session, user_id)
    assert resurrected_user.account_status == "active"
    assert resurrected_user.deleted_at is None
    assert resurrected_user.email == original_email
    assert resurrected_user.token_version > 0
    
    # Verify identities are NOT removed (per requirement)
    stmt = select(DeletedUserAuthIdentity).where(DeletedUserAuthIdentity.user_id == user_id)
    result = await db_session.execute(stmt)
    assert len(result.scalars().all()) > 0


async def test_invalid_password_resurrection_wrong_email(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test resurrecting a user with wrong email fails."""
    user_id = test_user.id
    username = test_user.username
    
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)
    
    # Attempt to resurrect with wrong email
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": "attacker@example.com",
            "password": "new_secure_password123"
        }
    )
    
    assert response.status_code == 409
    assert "Username already taken" in response.text


async def test_squatting_tombstoned_email_blocked(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test that an attacker cannot squat a tombstoned email with a different username."""
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email
    
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)
    
    # Charlie signs up with Alice's old email
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": "charlie",
            "email": original_email,
            "password": "password123"
        }
    )
    # The new spec strictly requires this to be blocked by the tombstone
    assert response.status_code == 409
    assert "Resurrect existing account OR choose a different email" in response.text
    
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
    # Setup test user as OAuth user
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
    
    # Verify user is deleted
    deleted_user = await User.get_by_id(db_session, user_id)
    assert deleted_user.account_status == "deleted"
    
    # We should mock get_oauth_user_info.
    from unittest.mock import patch
    from app.services.oauth_service import OAuthService
    
    oauth_service = OAuthService(db_session)
    
    oauth_info = {
        "id": "google-id-123",
        "email": original_email,
        "name": "Test User",
        "email_verified": True
    }
    
    with patch('app.services.oauth_service.get_oauth_user_info', return_value=oauth_info):
        response_data, is_new = await oauth_service.authenticate_oauth_user(
            provider="google",
            oauth_token={"access_token": "mock-token", "token_type": "Bearer"}
        )
    
    assert not is_new
    assert response_data["user"]["id"] == user_id
    assert response_data["user"]["email"] == original_email
    
    # Verify db state
    db_session.expire_all()
    resurrected_user = await User.get_by_id(db_session, user_id)
    assert resurrected_user.account_status == "active"
    assert resurrected_user.deleted_at is None
    
    # Verify identities are NOT removed
    stmt = select(DeletedUserAuthIdentity).where(DeletedUserAuthIdentity.user_id == user_id)
    result = await db_session.execute(stmt)
    assert len(result.scalars().all()) > 0


async def test_password_resurrection_mismatched_username(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User
):
    """Test that resurrection fails if requested username differs from tombstone username."""
    user_id = test_user.id
    username = test_user.username
    original_email = test_user.email
    
    deletion_service = UserDeletionService(db_session)
    await deletion_service.delete_user(user_id, username)
    
    # Attempt to resurrect with correct email but DIFFERENT username
    response = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": "different_user",
            "email": original_email,
            "password": "new_secure_password123"
        }
    )
    
    assert response.status_code == 409
    assert "Resurrect existing account OR choose a different email" in response.text
    
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
    
    # First resurrection request
    response1 = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123"
        }
    )
    assert response1.status_code == 201
    
    # Duplicate request with SAME credentials → idempotent success
    response2 = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "new_secure_password123"
        }
    )
    assert response2.status_code == 201
    data2 = response2.json()
    user_data2 = data2.get("data", {}).get("user", data2.get("user", {}))
    assert user_data2["id"] == user_id
    
    # Duplicate request with WRONG password → conflict
    response3 = await async_client.post(
        "/api/v1/auth/signup",
        json={
            "username": username,
            "email": original_email,
            "password": "wrong_password_here"
        }
    )
    assert response3.status_code == 409
    assert "Email already registered" in response3.text
