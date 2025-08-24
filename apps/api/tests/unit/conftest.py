"""
Unit test specific fixtures.
These tests focus on individual components without the full API stack.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.reaction_service import ReactionService


@pytest_asyncio.fixture
async def reaction_service(db_session: AsyncSession):
    """Create reaction service for unit testing."""
    return ReactionService(db_session)


@pytest_asyncio.fixture
async def isolated_db_session(test_engine):
    """Create an isolated database session for unit tests."""
    from sqlalchemy.orm import sessionmaker
    TestSessionLocal = sessionmaker(
        test_engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with TestSessionLocal() as session:
        yield session