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
