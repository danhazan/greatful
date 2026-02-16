"""
Integration test for optimized batch user profiles fetching.
"""

import pytest
import time
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post

@pytest.mark.asyncio
async def test_get_batch_user_profiles_integration(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    auth_headers: dict
):
    """Test that batch user profiles endpoint works correctly and efficiently."""
    
    # 1. Ensure test users have some posts/stats
    post1 = Post(author_id=test_user.id, content="Post 1", is_public=True)
    post2 = Post(author_id=test_user_2.id, content="Post 2", is_public=True)
    post3 = Post(author_id=test_user_2.id, content="Post 3", is_public=False)
    db_session.add_all([post1, post2, post3])
    await db_session.commit()
    
    user_ids = [test_user.id, test_user_2.id, test_user_3.id]
    
    # 2. Call the batch endpoint
    start_time = time.time()
    response = await async_client.post(
        "/api/v1/users/batch-profiles",
        json={"user_ids": user_ids},
        headers=auth_headers
    )
    execution_time = (time.time() - start_time) * 1000
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    
    profiles = data["data"]
    assert len(profiles) == 3
    
    # 3. Verify data for test_user_2 (has 2 posts, 1 public)
    user2_profile = next((p for p in profiles if p["id"] == test_user_2.id), None)
    assert user2_profile is not None
    assert user2_profile["posts_count"] == 2
    assert user2_profile["username"] == test_user_2.username
    
    # 4. Verify performance (should be fast locally, even with new logic)
    print(f"\nBatch fetch for {len(user_ids)} users took {execution_time:.2f}ms")
    # In a real environment, we'd check if it's much faster than N separate calls
    
@pytest.mark.asyncio
async def test_get_batch_user_profiles_empty_input(
    async_client: AsyncClient,
    auth_headers: dict
):
    """Test batch endpoint with empty input."""
    response = await async_client.post(
        "/api/v1/users/batch-profiles",
        json={"user_ids": []},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert data["data"] == []

@pytest.mark.asyncio
async def test_get_batch_user_profiles_non_existent_id(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict
):
    """Test batch endpoint with some non-existent IDs."""
    user_ids = [test_user.id, 99999, 88888]
    
    response = await async_client.post(
        "/api/v1/users/batch-profiles",
        json={"user_ids": user_ids},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    profiles = data["data"]
    
    # Should only return the profile for the existing user
    assert len(profiles) == 1
    assert profiles[0]["id"] == test_user.id
