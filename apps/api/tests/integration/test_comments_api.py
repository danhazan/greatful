"""
Integration tests for comments API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.core.security import create_access_token


@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password="hashed_password"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def another_user(db_session: AsyncSession):
    """Create another test user."""
    user = User(
        username="anotheruser",
        email="another@example.com",
        hashed_password="hashed_password"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_post(db_session: AsyncSession, test_user: User):
    """Create a test post."""
    post = Post(
        author_id=test_user.id,
        content="Test post for comments",
        post_type="spontaneous"
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


@pytest.fixture
def auth_headers(test_user: User):
    """Create authentication headers for test user."""
    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def another_auth_headers(another_user: User):
    """Create authentication headers for another user."""
    token = create_access_token(data={"sub": str(another_user.id)})
    return {"Authorization": f"Bearer {token}"}


class TestCreateComment:
    """Tests for POST /api/v1/posts/{post_id}/comments endpoint."""

    async def test_create_comment_success(
        self,
        async_client: AsyncClient,
        test_post: Post,
        auth_headers: dict
    ):
        """Test successful comment creation."""
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Great post! 😊"},
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()["data"]
        assert data["content"] == "Great post! 😊"
        assert data["post_id"] == test_post.id
        assert data["is_reply"] is False
        assert data["reply_count"] == 0
        assert "user" in data
        assert data["user"]["username"] == "testuser"

    async def test_create_comment_with_emoji(
        self,
        async_client: AsyncClient,
        test_post: Post,
        auth_headers: dict
    ):
        """Test comment creation with emoji support."""
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Love this! 💜🙏✨"},
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()["data"]
        assert "💜" in data["content"]
        assert "🙏" in data["content"]
        assert "✨" in data["content"]

    async def test_create_comment_empty_content(
        self,
        async_client: AsyncClient,
        test_post: Post,
        auth_headers: dict
    ):
        """Test comment creation with empty content fails."""
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "   "},
            headers=auth_headers
        )
        
        assert response.status_code == 422

    async def test_create_comment_too_long(
        self,
        async_client: AsyncClient,
        test_post: Post,
        auth_headers: dict
    ):
        """Test comment creation with content exceeding 500 characters fails."""
        long_content = "a" * 501
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": long_content},
            headers=auth_headers
        )
        
        assert response.status_code == 422

    async def test_create_comment_nonexistent_post(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test comment creation on nonexistent post fails."""
        response = await async_client.post(
            "/api/v1/posts/nonexistent-id/comments",
            json={"content": "Test comment"},
            headers=auth_headers
        )
        
        assert response.status_code == 404

    async def test_create_comment_unauthenticated(
        self,
        async_client: AsyncClient,
        test_post: Post
    ):
        """Test comment creation without authentication fails."""
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Test comment"}
        )
        
        # 403 is returned when no authentication is provided
        assert response.status_code == 403


class TestCreateReply:
    """Tests for POST /api/v1/comments/{comment_id}/replies endpoint."""

    async def test_create_reply_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_user: User,
        another_auth_headers: dict
    ):
        """Test successful reply creation."""
        # Create a parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)
        
        # Create a reply
        response = await async_client.post(
            f"/api/v1/comments/{parent_comment.id}/replies",
            json={"content": "Great point! 👍"},
            headers=another_auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()["data"]
        assert data["content"] == "Great point! 👍"
        assert data["parent_comment_id"] == parent_comment.id
        assert data["is_reply"] is True
        assert data["reply_count"] == 0
        assert data["user"]["username"] == "anotheruser"

    async def test_create_reply_to_nonexistent_comment(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test reply creation to nonexistent comment fails."""
        response = await async_client.post(
            "/api/v1/comments/nonexistent-id/replies",
            json={"content": "Test reply"},
            headers=auth_headers
        )
        
        assert response.status_code == 404

    async def test_create_reply_to_reply_fails(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that replies to replies are not allowed (single-level nesting only)."""
        # Create parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)
        
        # Create first-level reply
        first_reply = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="First reply",
            parent_comment_id=parent_comment.id
        )
        db_session.add(first_reply)
        await db_session.commit()
        await db_session.refresh(first_reply)
        
        # Try to create reply to reply (should fail)
        response = await async_client.post(
            f"/api/v1/comments/{first_reply.id}/replies",
            json={"content": "Reply to reply"},
            headers=auth_headers
        )
        
        assert response.status_code == 422


class TestGetPostComments:
    """Tests for GET /api/v1/posts/{post_id}/comments endpoint."""

    async def test_get_comments_empty(
        self,
        async_client: AsyncClient,
        test_post: Post,
        auth_headers: dict
    ):
        """Test getting comments for post with no comments."""
        response = await async_client.get(
            f"/api/v1/posts/{test_post.id}/comments",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 0

    async def test_get_comments_with_data(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test getting comments for post with comments."""
        # Create multiple comments
        comment1 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="First comment"
        )
        comment2 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Second comment"
        )
        db_session.add_all([comment1, comment2])
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/posts/{test_post.id}/comments",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["content"] == "First comment"
        assert data[1]["content"] == "Second comment"
        assert all(c["is_reply"] is False for c in data)

    async def test_get_comments_with_reply_count(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that reply_count is correctly calculated."""
        # Create parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)
        
        # Create replies
        reply1 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Reply 1",
            parent_comment_id=parent_comment.id
        )
        reply2 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Reply 2",
            parent_comment_id=parent_comment.id
        )
        db_session.add_all([reply1, reply2])
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/posts/{test_post.id}/comments",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["reply_count"] == 2

    async def test_get_comments_excludes_replies_by_default(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that replies are not included by default (performance optimization)."""
        # Create parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)
        
        # Create reply
        reply = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Reply",
            parent_comment_id=parent_comment.id
        )
        db_session.add(reply)
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/posts/{test_post.id}/comments",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["replies"] == []


class TestGetCommentReplies:
    """Tests for GET /api/v1/comments/{comment_id}/replies endpoint."""

    async def test_get_replies_empty(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test getting replies for comment with no replies."""
        # Create parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)
        
        response = await async_client.get(
            f"/api/v1/comments/{parent_comment.id}/replies",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 0

    async def test_get_replies_with_data(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test getting replies for comment with replies."""
        # Create parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)

        # Create replies
        reply1 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="First reply",
            parent_comment_id=parent_comment.id
        )
        reply2 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Second reply",
            parent_comment_id=parent_comment.id
        )
        db_session.add_all([reply1, reply2])
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/comments/{parent_comment.id}/replies",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["content"] == "First reply"
        assert data[1]["content"] == "Second reply"
        assert all(r["is_reply"] is True for r in data)
        # Only the last reply can be deleted (chronologically)
        assert data[0]["can_delete"] is False  # First reply cannot be deleted
        assert data[1]["can_delete"] is True   # Last reply can be deleted

    async def test_get_replies_nonexistent_comment(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test getting replies for nonexistent comment fails."""
        response = await async_client.get(
            "/api/v1/comments/nonexistent-id/replies",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestDeleteComment:
    """Tests for DELETE /api/v1/comments/{comment_id} endpoint."""

    async def test_delete_comment_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test successful comment deletion by owner."""
        # Create comment
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Test comment"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)
        
        response = await async_client.delete(
            f"/api/v1/comments/{comment.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["message"] == "Comment deleted successfully"

    async def test_delete_comment_not_owner(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_auth_headers: dict
    ):
        """Test that non-owner cannot delete comment."""
        # Create comment by test_user
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Test comment"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)
        
        # Try to delete with another_user's credentials
        response = await async_client.delete(
            f"/api/v1/comments/{comment.id}",
            headers=another_auth_headers
        )
        
        assert response.status_code == 403

    async def test_delete_comment_nonexistent(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test deleting nonexistent comment fails."""
        response = await async_client.delete(
            "/api/v1/comments/nonexistent-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404

    async def test_delete_comment_with_replies_cascades(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that deleting a parent comment also deletes its replies."""
        # Create parent comment
        parent_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent_comment)
        await db_session.commit()
        await db_session.refresh(parent_comment)
        parent_id = parent_comment.id

        # Create reply
        reply = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Reply",
            parent_comment_id=parent_comment.id
        )
        db_session.add(reply)
        await db_session.commit()
        await db_session.refresh(reply)

        # Verify we have 2 comments before deletion attempt
        from sqlalchemy import select, func
        count_query = select(func.count(Comment.id)).where(Comment.post_id == test_post.id)
        result = await db_session.execute(count_query)
        count_before = result.scalar()
        assert count_before == 2

        # Delete parent comment
        response = await async_client.delete(
            f"/api/v1/comments/{parent_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["message"] == "Comment deleted successfully"

        # Verify both parent and reply were deleted
        result = await db_session.execute(count_query)
        count_after = result.scalar()
        assert count_after == 0

    async def test_delete_reply_with_later_siblings_blocked(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that deleting a reply with later sibling replies is blocked.

        Only the chronologically last reply in a thread can be deleted.
        """
        from datetime import datetime, timezone, timedelta

        # Create top-level comment
        top_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Top level comment"
        )
        db_session.add(top_comment)
        await db_session.commit()
        await db_session.refresh(top_comment)

        # Create first reply with explicit timestamp
        earlier_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        reply1 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="First reply",
            parent_comment_id=top_comment.id
        )
        db_session.add(reply1)
        await db_session.commit()
        await db_session.refresh(reply1)
        reply1_id = reply1.id

        # Update the first reply's created_at to be earlier
        reply1.created_at = earlier_time
        await db_session.commit()

        # Create second reply (comes after chronologically - later timestamp)
        reply2 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Second reply",
            parent_comment_id=top_comment.id
        )
        db_session.add(reply2)
        await db_session.commit()
        await db_session.refresh(reply2)

        # Verify we have 3 comments
        from sqlalchemy import select, func
        count_query = select(func.count(Comment.id)).where(Comment.post_id == test_post.id)
        result = await db_session.execute(count_query)
        assert result.scalar() == 3

        # Verify reply1 is earlier than reply2
        await db_session.refresh(reply1)
        await db_session.refresh(reply2)
        assert reply1.created_at < reply2.created_at

        # Try to delete the first reply (has later sibling) - should be blocked
        response = await async_client.delete(
            f"/api/v1/comments/{reply1_id}",
            headers=auth_headers
        )

        # Should return 400 Bad Request with business logic error
        assert response.status_code == 400
        data = response.json()
        error_message = data.get("error", {}).get("message", "").lower()
        assert "later" in error_message or "sibling" in error_message or "replies" in error_message

        # Verify all 3 comments still exist
        result = await db_session.execute(count_query)
        assert result.scalar() == 3

    async def test_delete_last_reply_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that the last reply in a thread can be deleted successfully."""
        # Create top-level comment
        top_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Top level comment"
        )
        db_session.add(top_comment)
        await db_session.commit()
        await db_session.refresh(top_comment)

        # Create first reply
        reply1 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="First reply",
            parent_comment_id=top_comment.id
        )
        db_session.add(reply1)
        await db_session.commit()
        await db_session.refresh(reply1)

        # Create second reply (comes after chronologically)
        reply2 = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Second reply",
            parent_comment_id=top_comment.id
        )
        db_session.add(reply2)
        await db_session.commit()
        await db_session.refresh(reply2)
        reply2_id = reply2.id

        # Verify we have 3 comments
        from sqlalchemy import select, func
        count_query = select(func.count(Comment.id)).where(Comment.post_id == test_post.id)
        result = await db_session.execute(count_query)
        assert result.scalar() == 3

        # Delete the last reply - should succeed
        response = await async_client.delete(
            f"/api/v1/comments/{reply2_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["message"] == "Comment deleted successfully"

        # Verify we now have 2 comments
        result = await db_session.execute(count_query)
        assert result.scalar() == 2

    async def test_get_replies_can_delete_single_reply(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that a single reply in a thread can be deleted."""
        # Create top-level comment
        top_comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Top level comment"
        )
        db_session.add(top_comment)
        await db_session.commit()
        await db_session.refresh(top_comment)

        # Create a single reply
        reply = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Only reply",
            parent_comment_id=top_comment.id
        )
        db_session.add(reply)
        await db_session.commit()
        await db_session.refresh(reply)

        # Get replies for the top-level comment
        response = await async_client.get(
            f"/api/v1/comments/{top_comment.id}/replies",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1

        # The only reply should be deletable
        reply_data = data[0]
        assert reply_data["id"] == reply.id
        assert reply_data["can_delete"] is True


class TestUpdateComment:
    """Tests for comment editing functionality."""

    async def test_update_comment_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test successful comment update."""
        # Create a comment
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Original content"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)

        # Update the comment
        response = await async_client.put(
            f"/api/v1/comments/{comment.id}",
            json={"content": "Updated content"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["content"] == "Updated content"
        assert data["edited_at"] is not None

    async def test_update_comment_not_owner(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_auth_headers: dict
    ):
        """Test that non-owner cannot update comment."""
        # Create comment by test_user
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Original content"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)

        # Try to update with another_user's credentials
        response = await async_client.put(
            f"/api/v1/comments/{comment.id}",
            json={"content": "Hacked content"},
            headers=another_auth_headers
        )

        assert response.status_code == 403

    async def test_update_comment_empty_content(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that empty content is rejected."""
        # Create a comment
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Original content"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)

        # Try to update with empty content
        response = await async_client.put(
            f"/api/v1/comments/{comment.id}",
            json={"content": "   "},
            headers=auth_headers
        )

        assert response.status_code == 422

    async def test_update_comment_too_long(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that content over 500 chars is rejected."""
        # Create a comment
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Original content"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)

        # Try to update with content too long
        response = await async_client.put(
            f"/api/v1/comments/{comment.id}",
            json={"content": "x" * 501},
            headers=auth_headers
        )

        assert response.status_code == 422

    async def test_update_comment_nonexistent(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test updating nonexistent comment fails."""
        response = await async_client.put(
            "/api/v1/comments/nonexistent-id",
            json={"content": "Updated content"},
            headers=auth_headers
        )

        assert response.status_code == 404

    async def test_update_comment_with_emoji(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test updating comment with emoji content."""
        # Create a comment
        comment = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Original content"
        )
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)

        # Update with emoji
        response = await async_client.put(
            f"/api/v1/comments/{comment.id}",
            json={"content": "Updated with emojis! "},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert "" in data["content"]
