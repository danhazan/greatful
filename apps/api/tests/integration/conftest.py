"""
Integration test specific fixtures.
These tests use the full API stack with FastAPI TestClient.
"""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from main import app


@pytest.fixture(scope="function")
def client(setup_test_database):
    """Create synchronous test client for integration tests."""
    # The setup_test_database fixture already overrides the database dependency
    # Create client without context manager to avoid startup/shutdown issues
    test_client = TestClient(app)
    yield test_client
    # Manual cleanup
    test_client.close()


@pytest_asyncio.fixture
async def async_client(setup_test_database):
    """Create async test client for integration tests."""
    # The database dependency is already overridden by setup_test_database fixture
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def authenticated_client(async_client, auth_headers):
    """Create authenticated async client."""
    async_client.headers.update(auth_headers)
    yield async_client



@pytest_asyncio.fixture
async def test_user_and_post(setup_test_database):
    """Create test user and post for reactions testing."""
    TestSessionLocal = setup_test_database
    
    async with TestSessionLocal() as session:
        from app.models.user import User
        from app.models.post import Post, PostType
        from app.core.security import create_access_token, get_password_hash
        import uuid
        
        # Create user
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password=get_password_hash("testpassword")
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        # Create post
        post = Post(
            id=str(uuid.uuid4()),
            author_id=user.id,
            content="I'm grateful for testing!",
            post_type=PostType.daily,
            is_public=True
        )
        session.add(post)
        await session.commit()
        await session.refresh(post)
        
        # Create access token
        token = create_access_token({"sub": str(user.id)})
        
        return {
            "user": user,
            "post": post,
            "token": token
        }