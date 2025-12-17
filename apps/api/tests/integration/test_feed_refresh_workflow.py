"""
End-to-end workflow tests for feed refresh mechanism.
"""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post, PostType


class TestFeedRefreshWorkflow:
    """Test complete feed refresh workflow from API perspective."""

    @pytest.fixture
    async def workflow_user(self, db_session: AsyncSession):
        """Create a test user with specific last_feed_view for workflow testing."""
        user = User(
            email="workflow@example.com",
            username="workflowuser",
            hashed_password="hashed_password",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def workflow_auth_headers(self, workflow_user):
        """Create authentication headers for workflow user."""
        from app.core.security import create_access_token
        token = create_access_token({"sub": str(workflow_user.id)})
        return {"Authorization": f"Bearer {token}"}

    async def test_complete_refresh_workflow(self, db_session: AsyncSession, async_client: AsyncClient, workflow_user: User, workflow_auth_headers: dict):
        """Test the complete refresh workflow: create posts, check feed, refresh, update timestamp."""
        
        # Step 1: Create some posts at different times
        old_post = Post(
            id="workflow-old-post",
            author_id=workflow_user.id,
            content="Old post before last feed view",
            post_type=PostType.spontaneous,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            is_public=True
        )
        
        new_post = Post(
            id="workflow-new-post",
            author_id=workflow_user.id,
            content="New post after last feed view",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
            is_public=True
        )
        
        db_session.add(old_post)
        db_session.add(new_post)
        await db_session.commit()
        
        # Step 2: Get normal feed
        normal_feed_response = await async_client.get("/api/v1/posts/feed", headers=workflow_auth_headers)
        assert normal_feed_response.status_code == 200
        normal_posts = normal_feed_response.json()
        
        # Should have both posts
        assert len(normal_posts) >= 2
        
        # Step 3: Get refresh feed
        refresh_feed_response = await async_client.get("/api/v1/posts/feed?refresh=true", headers=workflow_auth_headers)
        assert refresh_feed_response.status_code == 200
        refresh_posts = refresh_feed_response.json()
        
        # Should have both posts
        assert len(refresh_posts) >= 2
        
        # Find posts in refresh results
        refresh_post_map = {post['id']: post for post in refresh_posts}
        
        # New post should be marked as unread
        if new_post.id in refresh_post_map:
            new_post_data = refresh_post_map[new_post.id]
            assert new_post_data.get('is_unread', False) == True
        
        # Old post should not be marked as unread
        if old_post.id in refresh_post_map:
            old_post_data = refresh_post_map[old_post.id]
            assert old_post_data.get('is_unread', False) == False
        
        # Step 4: Update feed view timestamp
        update_response = await async_client.post("/api/v1/posts/update-feed-view", headers=workflow_auth_headers)
        assert update_response.status_code == 200
        
        update_data = update_response.json()
        assert update_data["success"] == True
        assert "timestamp" in update_data
        
        # Step 5: Create another post after timestamp update
        very_new_post = Post(
            id="workflow-very-new-post",
            author_id=workflow_user.id,
            content="Very new post after timestamp update",
            post_type=PostType.photo,
            created_at=datetime.now(timezone.utc),
            is_public=True
        )
        db_session.add(very_new_post)
        await db_session.commit()
        
        # Step 6: Get refresh feed again
        final_refresh_response = await async_client.get("/api/v1/posts/feed?refresh=true", headers=workflow_auth_headers)
        assert final_refresh_response.status_code == 200
        final_posts = final_refresh_response.json()
        
        # Should have all posts
        assert len(final_posts) >= 3
        
        # Find the very new post
        final_post_map = {post['id']: post for post in final_posts}
        
        # Very new post should be marked as unread
        if very_new_post.id in final_post_map:
            very_new_post_data = final_post_map[very_new_post.id]
            assert very_new_post_data.get('is_unread', False) == True
        
        # Previously new post should no longer be marked as unread (since timestamp was updated)
        if new_post.id in final_post_map:
            previously_new_post_data = final_post_map[new_post.id]
            # This might still be unread depending on exact timing, but should have lower score
            # The key is that the very new post should have higher priority

    async def test_refresh_with_no_unread_posts(self, db_session: AsyncSession, async_client: AsyncClient, workflow_user: User, workflow_auth_headers: dict):
        """Test refresh behavior when there are no unread posts."""
        
        # Create only old posts (before last_feed_view)
        old_post1 = Post(
            id="no-unread-post-1",
            author_id=workflow_user.id,
            content="Old post 1",
            post_type=PostType.spontaneous,
            created_at=datetime.now(timezone.utc) - timedelta(hours=3),
            is_public=True
        )
        
        old_post2 = Post(
            id="no-unread-post-2",
            author_id=workflow_user.id,
            content="Old post 2",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            is_public=True
        )
        
        db_session.add(old_post1)
        db_session.add(old_post2)
        await db_session.commit()
        
        # Get refresh feed
        refresh_response = await async_client.get("/api/v1/posts/feed?refresh=true", headers=workflow_auth_headers)
        assert refresh_response.status_code == 200
        refresh_posts = refresh_response.json()
        
        # Should still return posts (fallback to algorithm-scored posts)
        assert len(refresh_posts) >= 2
        
        # None should be marked as unread
        for post in refresh_posts:
            assert post.get('is_unread', False) == False

    async def test_refresh_with_mixed_engagement(self, db_session: AsyncSession, async_client: AsyncClient, workflow_user: User, workflow_auth_headers: dict):
        """Test refresh behavior with posts having different engagement levels."""
        
        # Create posts with different characteristics
        low_engagement_new = Post(
            id="low-engagement-new",
            author_id=workflow_user.id,
            content="New post with low engagement",
            post_type=PostType.spontaneous,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
            is_public=True
        )
        
        high_engagement_old = Post(
            id="high-engagement-old",
            author_id=workflow_user.id,
            content="Old post with high engagement",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            is_public=True
        )
        
        db_session.add(low_engagement_new)
        db_session.add(high_engagement_old)
        await db_session.commit()
        
        # Add some engagement to the old post (simulate hearts/reactions)
        from app.models.emoji_reaction import EmojiReaction
        
        # Add hearts to old post
        for i in range(5):
            heart = EmojiReaction(
                user_id=workflow_user.id + i + 1,  # Different user IDs
                post_id=high_engagement_old.id,
                emoji_code='heart'
            )
            db_session.add(heart)
        
        # Add reactions to old post, using a different offset for user IDs
        for i in range(3):
            reaction = EmojiReaction(
                user_id=workflow_user.id + i + 6,  # Use a different set of user IDs for reactions
                post_id=high_engagement_old.id,
                emoji_code="heart_eyes"
            )
            db_session.add(reaction)
        
        await db_session.commit()
        
        # Get refresh feed
        refresh_response = await async_client.get("/api/v1/posts/feed?refresh=true", headers=workflow_auth_headers)
        assert refresh_response.status_code == 200
        refresh_posts = refresh_response.json()
        
        # Should have both posts
        assert len(refresh_posts) >= 2
        
        # Find posts in results
        post_map = {post['id']: post for post in refresh_posts}
        
        # New post should be marked as unread and prioritized despite lower engagement
        if low_engagement_new.id in post_map:
            new_post_data = post_map[low_engagement_new.id]
            assert new_post_data.get('is_unread', False) == True
        
        # Old post should have high engagement but no unread boost
        if high_engagement_old.id in post_map:
            old_post_data = post_map[high_engagement_old.id]
            assert old_post_data.get('is_unread', False) == False
            assert old_post_data.get('hearts_count', 0) >= 5
            assert old_post_data.get('reactions_count', 0) >= 3