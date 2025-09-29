"""
Shared test fixtures and configuration for backend tests.
This file provides common setup for all tests following the Test Guidelines.
"""

import os
import pytest
import pytest_asyncio

# Set up test environment variables
os.environ.update({
    'TESTING': 'true',
    'LOAD_TESTING': 'true',
    'ENVIRONMENT': 'development',
    'DEFAULT_RATE_LIMIT': '1000',
    'AUTH_RATE_LIMIT': '100',
    'UPLOAD_RATE_LIMIT': '200',
    'ALLOWED_ORIGINS': 'http://localhost:3000',
    'SECRET_KEY': 'test-secret-key-for-testing-only-not-secure',
    'SSL_REDIRECT': 'false',
    'SECURE_COOKIES': 'false',
    'LOG_LEVEL': 'WARNING',
    # OAuth test configuration
    'GOOGLE_CLIENT_ID': 'test-google-client-id',
    'GOOGLE_CLIENT_SECRET': 'test-google-client-secret',
    'FACEBOOK_CLIENT_ID': 'test-facebook-client-id',
    'FACEBOOK_CLIENT_SECRET': 'test-facebook-client-secret'
})
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.models.user import User
from app.models.post import Post, PostType
from app.core.security import create_access_token, get_password_hash
from main import app
import uuid
from unittest.mock import patch


# Test database URL - use unique in-memory SQLite for each test
import tempfile
import os

def get_test_database_url():
    """Generate a unique test database URL."""
    return "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        get_test_database_url(), 
        echo=False,  # Reduce noise in test output
        pool_pre_ping=True,
        pool_recycle=300,
        poolclass=None  # Disable connection pooling for tests
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def setup_test_database(test_engine):
    """Set up test database session factory."""
    # Set testing environment variable to disable security middleware
    os.environ['TESTING'] = 'true'
    
    TestSessionLocal = sessionmaker(
        test_engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    # Clean up tables before each test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Override the database dependency
    async def get_test_db():
        async with TestSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()
    
    # Mock the init_db function to prevent startup database initialization
    with patch('app.core.database.init_db') as mock_init_db:
        mock_init_db.return_value = None
        
        # Also mock the uptime monitor to prevent startup issues
        with patch('app.core.uptime_monitoring.uptime_monitor.start_monitoring') as mock_uptime_start:
            with patch('app.core.uptime_monitoring.uptime_monitor.stop_monitoring') as mock_uptime_stop:
                mock_uptime_start.return_value = None
                mock_uptime_stop.return_value = None
                
                # Clear any existing overrides first
                app.dependency_overrides.clear()
                app.dependency_overrides[get_db] = get_test_db
                
                yield TestSessionLocal
                
                # Cleanup
                app.dependency_overrides.clear()
                # Clean up testing environment variable
                if 'TESTING' in os.environ:
                    del os.environ['TESTING']


@pytest_asyncio.fixture
async def db_session(setup_test_database):
    """Provide a database session for tests."""
    TestSessionLocal = setup_test_database
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(db_session):
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpassword"),
        bio="Test bio"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_2(db_session):
    """Create a second test user."""
    user = User(
        email="test2@example.com",
        username="testuser2",
        hashed_password=get_password_hash("testpassword2"),
        bio="Test bio 2"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_3(db_session):
    """Create a third test user."""
    user = User(
        email="test3@example.com",
        username="testuser3",
        hashed_password=get_password_hash("testpassword3"),
        bio="Test bio 3"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_with_profile(db_session):
    """Create a test user with profile picture."""
    user = User(
        email="profileuser@example.com",
        username="profileuser",
        hashed_password=get_password_hash("testpassword"),
        bio="User with profile picture",
        display_name="Profile User",
        profile_image_url="https://example.com/profile-pic.jpg"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user):
    """Create authentication headers for test user."""
    token = create_access_token({"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_headers_2(test_user_2):
    """Create authentication headers for second test user."""
    token = create_access_token({"sub": str(test_user_2.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_post(db_session, test_user):
    """Create a test post."""
    post = Post(
        id=str(uuid.uuid4()),
        author_id=test_user.id,
        content="I'm grateful for testing!",
        post_type=PostType.daily,
        is_public=True
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


@pytest_asyncio.fixture
async def client(setup_test_database):
    """Create test client with proper database setup."""
    with TestClient(app) as test_client:
        yield test_client


@pytest_asyncio.fixture
async def async_client():
    """Create async test client."""
    from httpx import AsyncClient
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


# Test data factories
class TestDataFactory:
    """Factory for creating test data."""
    
    @staticmethod
    def user_data(**overrides):
        """Create user data for testing."""
        data = {
            "email": "test@example.com",
            "username": "testuser",
            "bio": "Test bio"
        }
        data.update(overrides)
        return data
    
    @staticmethod
    def post_data(**overrides):
        """Create post data for testing."""
        data = {
            "content": "I'm grateful for this test!",
            "post_type": "daily",
            "is_public": True
        }
        data.update(overrides)
        return data


@pytest.fixture
def test_data_factory():
    """Provide test data factory."""
    return TestDataFactory


# Additional fixtures for contract testing
@pytest_asyncio.fixture
async def http_client(setup_test_database):
    """Create async HTTP client for contract testing."""
    from httpx import AsyncClient
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def test_post_dict(http_client, auth_headers):
    """Create a test post and return it as a dictionary."""
    post_data = {
        "content": "Test gratitude post for contract testing",
        "post_type": "daily",
        "title": "Test Post",
        "is_public": True
    }
    
    response = await http_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
    assert response.status_code == 201
    
    data = response.json()
    # The API returns the post data directly, not wrapped in a success/data structure
    return data





@pytest_asyncio.fixture
async def fastapi_app():
    """Provide FastAPI app instance for testing."""
    return app


@pytest.fixture
def contract_validator():
    """Provide contract validator instance for testing."""
    from app.core.contract_validation import ContractValidator
    return ContractValidator()


@pytest_asyncio.fixture
async def oauth_initialized():
    """Initialize OAuth for testing."""
    from app.core.oauth_config import oauth_config
    try:
        oauth_config.initialize_oauth()
    except Exception as e:
        # OAuth initialization might fail in test environment, that's ok
        pass
    yield oauth_config