"""
Integration tests for post deletion with comment tree cleanup.
"""

from httpx import AsyncClient
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User


class TestPostDeletionComments:
    """Tests for DELETE /api/v1/posts/{post_id} comment cleanup behavior."""

    async def test_delete_post_with_no_comments(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        auth_headers: dict
    ):
        """Deleting a post with zero comments succeeds and removes the post."""
        response = await async_client.delete(
            f"/api/v1/posts/{test_post.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        remaining_post_count = await db_session.scalar(
            select(func.count(Post.id)).where(Post.id == test_post.id)
        )
        assert remaining_post_count == 0

    async def test_delete_post_removes_top_level_and_replies(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """
        Deleting a post removes all related comments, including nested replies.

        Mixed structure:
        - top-level comment with reply
        - second top-level comment without replies
        """
        parent = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Parent comment"
        )
        db_session.add(parent)
        await db_session.commit()
        await db_session.refresh(parent)

        reply = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Reply to parent",
            parent_comment_id=parent.id
        )
        sibling_top_level = Comment(
            post_id=test_post.id,
            user_id=test_user.id,
            content="Another top-level comment"
        )
        db_session.add_all([reply, sibling_top_level])
        await db_session.commit()

        before_count = await db_session.scalar(
            select(func.count(Comment.id)).where(Comment.post_id == test_post.id)
        )
        assert before_count == 3

        response = await async_client.delete(
            f"/api/v1/posts/{test_post.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        remaining_comment_count = await db_session.scalar(
            select(func.count(Comment.id)).where(Comment.post_id == test_post.id)
        )
        assert remaining_comment_count == 0

        remaining_post_count = await db_session.scalar(
            select(func.count(Post.id)).where(Post.id == test_post.id)
        )
        assert remaining_post_count == 0
