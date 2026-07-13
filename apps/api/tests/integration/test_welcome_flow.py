import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from app.models.user import User

@pytest.fixture
async def uncompleted_user(test_engine):
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        from app.core.security import get_password_hash
        user = User(
            email="incomplete@example.com",
            username="incomplete_user",
            hashed_password=get_password_hash("password123"),
            account_status="active",
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

@pytest.fixture
def uncompleted_token(uncompleted_user):
    from app.core.security import create_access_token
    token_data = {
        "sub": str(uncompleted_user.id),
        "username": uncompleted_user.username,
        "token_version": getattr(uncompleted_user, "token_version", 0) or 0,
    }
    return create_access_token(token_data)

@pytest.fixture
async def uncompleted_user_with_photo(test_engine):
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        from app.core.security import get_password_hash
        user = User(
            email="photo_user@example.com",
            username="photo_user",
            hashed_password=get_password_hash("password123"),
            account_status="active",
            profile_image_url="https://oauth.example.com/photo.jpg",
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

@pytest.fixture
def uncompleted_photo_token(uncompleted_user_with_photo):
    from app.core.security import create_access_token
    token_data = {
        "sub": str(uncompleted_user_with_photo.id),
        "username": uncompleted_user_with_photo.username,
        "token_version": getattr(uncompleted_user_with_photo, "token_version", 0) or 0,
    }
    return create_access_token(token_data)

@pytest.fixture
async def existing_user(test_engine):
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        from app.core.security import get_password_hash
        user = User(
            email="existing@example.com",
            username="existing_user",
            hashed_password=get_password_hash("password123"),
            account_status="active"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

@pytest.mark.asyncio
async def test_complete_onboarding_success(async_client: AsyncClient, uncompleted_token: str, test_engine):
    headers = {"Authorization": f"Bearer {uncompleted_token}"}
    form_data = {
        "username": "newly_onboarded",
        "display_name": "Newly Onboarded User",
        "bio": "Hello world!"
    }
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)
    
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["username"] == "newly_onboarded"
    assert data["display_name"] == "Newly Onboarded User"

@pytest.mark.asyncio
async def test_complete_onboarding_without_signup_token_succeeds(async_client: AsyncClient, uncompleted_token: str, test_engine):
    headers = {"Authorization": f"Bearer {uncompleted_token}"}
    form_data = {"username": "no_token_user", "display_name": "No Token"}
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_complete_onboarding_validation_failure_zero_changes(async_client: AsyncClient, uncompleted_token: str, test_engine, existing_user):
    headers = {"Authorization": f"Bearer {uncompleted_token}"}
    
    # Make a request that will fail validation (username already taken)
    form_data = {
        "username": "existing_user",
        "display_name": "This shouldn't save",
        "bio": "Nor should this"
    }
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)
    
    assert response.status_code == 409

    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "already_exists"
    assert data["error"]["message"] == "Username already taken"

    # Verify DB has zero changes
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.future import select
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == "incomplete@example.com"))).scalar_one()
        assert user.username == "incomplete_user"
        assert user.display_name is None
        assert user.bio is None

@pytest.mark.asyncio
async def test_complete_onboarding_invalid_username_format(async_client: AsyncClient, uncompleted_token: str, test_engine):
    """Invalid username format returns validation_error, not already_exists."""
    headers = {"Authorization": f"Bearer {uncompleted_token}"}
    form_data = {"username": "john@smith", "display_name": "Bad Username"}
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "validation_error"
    assert data["error"]["message"] == "Username can only contain letters, numbers, and underscores."

    # Verify no partial DB write occurred
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.future import select
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == "incomplete@example.com"))).scalar_one()
        assert user.username == "incomplete_user"
        assert user.display_name is None

@pytest.mark.asyncio
async def test_complete_onboarding_remove_profile_photo(async_client: AsyncClient, uncompleted_photo_token: str, test_engine):
    """remove_profile_image=true deletes existing photo when no file uploaded."""
    headers = {"Authorization": f"Bearer {uncompleted_photo_token}"}
    form_data = {
        "username": "photo_removed_user",
        "display_name": "Photo Removed",
        "remove_profile_image": "true",
    }
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["profile_image_url"] is None

    # Verify DB
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.future import select
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == "photo_user@example.com"))).scalar_one()
        assert user.profile_image_url is None

@pytest.mark.asyncio
async def test_complete_onboarding_remove_profile_photo_noop_when_none(async_client: AsyncClient, uncompleted_token: str, test_engine):
    """remove_profile_image=true on a user with no photo is a no-op (no error)."""
    headers = {"Authorization": f"Bearer {uncompleted_token}"}
    form_data = {
        "username": "no_photo_user",
        "display_name": "No Photo",
        "remove_profile_image": "true",
    }
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["profile_image_url"] is None

@pytest.mark.asyncio
async def test_complete_onboarding_remove_ignored_when_file_present(async_client: AsyncClient, uncompleted_photo_token: str, test_engine):
    """When both file and remove_profile_image=true are sent, file wins (remove is ignored).
    Even if the file is invalid, remove_profile_image should NOT be processed."""
    headers = {"Authorization": f"Bearer {uncompleted_photo_token}"}
    form_data = {
        "username": "file_wins_user",
        "display_name": "File Wins",
        "remove_profile_image": "true",
    }
    files = {"file": ("test-photo.jpg", b"fake-image-data", "image/jpeg")}
    response = await async_client.post(
        "/api/v1/users/me/onboarding", headers=headers, data=form_data, files=files
    )
    # File validation fails (400) — but the old photo should still be intact
    # because remove_profile_image was gated behind the elif (not processed)
    assert response.status_code == 400

    # Verify DB: old photo is still present (remove_profile_image was NOT processed)
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.future import select
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == "photo_user@example.com"))).scalar_one()
        assert user.profile_image_url == "https://oauth.example.com/photo.jpg"

@pytest.mark.asyncio
async def test_complete_onboarding_oauth_remove_full_flow(async_client: AsyncClient, uncompleted_photo_token: str, test_engine):
    """Full OAuth flow: user has imported photo → removes on welcome → Finish → no photo in DB/API."""
    headers = {"Authorization": f"Bearer {uncompleted_photo_token}"}
    form_data = {
        "username": "oauth_removed_photo",
        "display_name": "OAuth Removed",
        "remove_profile_image": "true",
    }
    response = await async_client.post("/api/v1/users/me/onboarding", headers=headers, data=form_data)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["profile_image_url"] is None

    # Verify DB directly
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.future import select
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == "photo_user@example.com"))).scalar_one()
        assert user.profile_image_url is None

    # Verify profile API also returns no photo
    profile_response = await async_client.get("/api/v1/users/me/profile", headers=headers)
    assert profile_response.status_code == 200
    profile_data = profile_response.json()["data"]
    assert profile_data["profile_image_url"] is None
