"""
Unit tests for emoji reactions functionality.
Uses shared fixtures from conftest.py files.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.models.emoji_reaction import EmojiReaction
from app.models.comment import Comment
from app.models.notification import Notification
from app.services.reaction_service import ReactionService
import uuid
from sqlalchemy import event, select


# Using shared test_post fixture from conftest.py


class TestEmojiReactionModel:
    """Test the EmojiReaction model."""

    def test_valid_emojis(self):
        """Test that valid emoji codes are recognized."""
        valid_codes = ['heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'grateful', 'praise', 'clap']
        
        for code in valid_codes:
            assert EmojiReaction.is_valid_emoji(code)

    def test_invalid_emojis(self):
        """Test that invalid emoji codes are rejected."""
        invalid_codes = ['angry', 'sad', 'thumbs_down', 'invalid', 'joy', 'thinking', 'crying', 'rage', 'poop']
        
        for code in invalid_codes:
            assert not EmojiReaction.is_valid_emoji(code)

    def test_emoji_display_property(self):
        """Test that emoji_display returns correct emoji characters."""
        reaction = EmojiReaction(emoji_code='heart_eyes')
        assert reaction.emoji_display == '😍'
        
    def test_new_unified_emojis_supported(self):
        """Test that new unified emoji system emojis are supported."""
        # Test the new heart emoji (unified with likes)
        assert EmojiReaction.is_valid_emoji('heart')
        assert EmojiReaction.is_valid_emoji('grateful')
        assert EmojiReaction.is_valid_emoji('praise')
        
        # Test their display
        heart_reaction = EmojiReaction(emoji_code='heart')
        assert heart_reaction.emoji_display == '💜'
        
        praise_reaction = EmojiReaction(emoji_code='praise')
        assert praise_reaction.emoji_display == '🙌'
        
        # Test other emojis as well
        pray_reaction = EmojiReaction(emoji_code='pray')
        assert pray_reaction.emoji_display == '🙏'
        
        # Test invalid emoji fallback
        invalid_reaction = EmojiReaction(emoji_code='invalid')
        assert invalid_reaction.emoji_display == '❓'

    async def test_create_emoji_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test creating an emoji reaction."""
        reaction = EmojiReaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        db_session.add(reaction)
        await db_session.commit()
        await db_session.refresh(reaction)
        
        assert reaction.id is not None
        assert reaction.user_id == test_user.id
        assert reaction.post_id == test_post.id
        assert reaction.emoji_code == 'heart_eyes'
        assert reaction.emoji_display == '😍'


class TestReactionService:
    """Test the ReactionService business logic."""

    async def test_add_reaction_success(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test successfully adding a reaction."""
        service = ReactionService(db_session)
        reaction_data = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        assert reaction_data["user_id"] == test_user.id
        assert reaction_data["post_id"] == test_post.id
        assert reaction_data["emoji_code"] == 'heart_eyes'

    async def test_add_reaction_invalid_emoji(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test adding reaction with invalid emoji code."""
        service = ReactionService(db_session)
        with pytest.raises(Exception, match="Invalid emoji code"):
            await service.add_reaction(
                user_id=test_user.id,
                post_id=test_post.id,
                emoji_code='invalid_emoji'
            )

    async def test_add_reaction_nonexistent_user(self, db_session: AsyncSession, test_post: Post):
        """Test adding reaction with nonexistent user."""
        from app.core.exceptions import NotFoundError
        service = ReactionService(db_session)
        with pytest.raises(NotFoundError) as exc_info:
            await service.add_reaction(
                user_id=99999,
                post_id=test_post.id,
                emoji_code='heart_eyes'
            )
        assert "User not found" in exc_info.value.detail

    async def test_add_reaction_nonexistent_post(self, db_session: AsyncSession, test_user: User):
        """Test adding reaction with nonexistent post."""
        from app.core.exceptions import NotFoundError
        service = ReactionService(db_session)
        with pytest.raises(NotFoundError) as exc_info:
            await service.add_reaction(
                user_id=test_user.id,
                post_id="nonexistent-post-id",
                emoji_code='heart_eyes'
            )
        assert "Post not found" in exc_info.value.detail

    async def test_update_existing_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test updating an existing reaction."""
        service = ReactionService(db_session)
        # Add initial reaction
        reaction1 = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Update to different emoji
        reaction2 = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='pray'
        )
        
        # Should be the same reaction object, just updated
        assert reaction1["id"] == reaction2["id"]
        assert reaction2["emoji_code"] == 'pray'

    async def test_remove_reaction_success(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test successfully removing a reaction."""
        service = ReactionService(db_session)
        # Add reaction first
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Remove reaction
        removed = await service.remove_reaction(
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert removed is True

    async def test_remove_nonexistent_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test removing a reaction that doesn't exist."""
        service = ReactionService(db_session)
        removed = await service.remove_reaction(
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert removed is False

    async def test_get_post_reactions(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting all reactions for a post."""
        service = ReactionService(db_session)
        # Add a reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Get reactions
        reactions = await service.get_post_reactions(
            post_id=test_post.id
        )
        
        assert len(reactions) == 1
        assert reactions[0]["emoji_code"] == 'heart_eyes'
        assert reactions[0]["user"]["username"] == test_user.username

    async def test_get_user_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting a specific user's reaction."""
        service = ReactionService(db_session)
        # Add reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='pray'
        )
        
        # Get user's reaction
        reaction = await service.get_user_reaction(
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert reaction is not None
        assert reaction.emoji_code == 'pray'

    async def test_get_reaction_counts(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting reaction counts grouped by emoji."""
        service = ReactionService(db_session)
        # Add reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Get counts
        counts = await service.get_reaction_counts(
            post_id=test_post.id
        )
        
        assert counts['heart_eyes'] == 1

    async def test_get_total_reaction_count(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting total reaction count for a post."""
        service = ReactionService(db_session)
        # Initially should be 0
        count = await service.get_total_reaction_count(
            post_id=test_post.id
        )
        assert count == 0
        
        # Add reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Should now be 1
        count = await service.get_total_reaction_count(
            post_id=test_post.id
        )
        assert count == 1

    async def test_add_comment_reaction_success(self, db_session: AsyncSession, test_user: User, test_user_2: User, test_post: Post):
        """Test successfully adding a reaction to a comment."""
        comment = Comment(
            id=str(uuid.uuid4()),
            post_id=test_post.id,
            user_id=test_user_2.id,
            content="A thoughtful comment"
        )
        db_session.add(comment)
        await db_session.commit()

        service = ReactionService(db_session)
        reaction_data = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code="heart_eyes",
            object_type="comment",
            object_id=comment.id
        )

        assert reaction_data["object_type"] == "comment"
        assert reaction_data["object_id"] == comment.id
        assert reaction_data["emoji_code"] == "heart_eyes"

    async def test_comment_reaction_rejects_wrong_post(self, db_session: AsyncSession, test_user: User, test_user_2: User, test_post: Post):
        """Comment reactions cannot target comments from another post."""
        other_post = Post(
            id=str(uuid.uuid4()),
            author=test_user,
            content="Another post",
            is_public=True
        )
        db_session.add(other_post)
        await db_session.flush()
        comment = Comment(
            id=str(uuid.uuid4()),
            post_id=other_post.id,
            user_id=test_user_2.id,
            content="Wrong post comment"
        )
        db_session.add(comment)
        await db_session.commit()

        service = ReactionService(db_session)
        with pytest.raises(Exception, match="Comment reaction target does not belong to the post"):
            await service.add_reaction(
                user_id=test_user.id,
                post_id=test_post.id,
                emoji_code="heart_eyes",
                object_type="comment",
                object_id=comment.id
            )

    async def test_comment_reaction_summaries_are_grouped(self, db_session: AsyncSession, test_user: User, test_user_2: User, test_user_3: User, test_post: Post):
        """Comment reaction summaries are aggregated across the post without per-comment lookups."""
        comment = Comment(
            id=str(uuid.uuid4()),
            post_id=test_post.id,
            user_id=test_user_2.id,
            content="A thoughtful comment"
        )
        db_session.add(comment)
        await db_session.commit()

        service = ReactionService(db_session)
        await service.add_reaction(test_user.id, test_post.id, "heart", object_type="comment", object_id=comment.id)
        await service.add_reaction(test_user_3.id, test_post.id, "fire", object_type="comment", object_id=comment.id)

        summaries = await service.get_comment_reaction_summaries(test_post.id, test_user.id)

        assert summaries[comment.id]["totalCount"] == 2
        assert summaries[comment.id]["emojiCounts"] == {"heart": 1, "fire": 1}
        assert summaries[comment.id]["userReaction"] == "heart"

    async def test_comment_reaction_summaries_use_bounded_queries(self, db_session: AsyncSession, test_user: User, test_user_2: User, test_user_3: User, test_post: Post):
        """Summary aggregation stays bounded for larger comment sets."""
        comments = [
            Comment(
                id=str(uuid.uuid4()),
                post_id=test_post.id,
                user_id=test_user_2.id,
                content=f"Comment {idx}"
            )
            for idx in range(10)
        ]
        db_session.add_all(comments)
        await db_session.commit()

        service = ReactionService(db_session)
        for comment in comments:
            await service.add_reaction(test_user.id, test_post.id, "heart", object_type="comment", object_id=comment.id)
            await service.add_reaction(test_user_3.id, test_post.id, "fire", object_type="comment", object_id=comment.id)

        statements = []

        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        sync_engine = db_session.bind.sync_engine
        event.listen(sync_engine, "before_cursor_execute", before_cursor_execute)
        try:
            summaries = await service.get_comment_reaction_summaries(test_post.id, test_user.id)
        finally:
            event.remove(sync_engine, "before_cursor_execute", before_cursor_execute)

        assert len(summaries) == len(comments)
        assert len(statements) <= 3

    async def test_comment_reaction_notification_targets_comment_author_only(self, db_session: AsyncSession, test_user: User, test_user_2: User, test_user_3: User, test_post: Post):
        """Reply reactions notify the reply author, not parent comment or post author."""
        parent = Comment(
            id=str(uuid.uuid4()),
            post_id=test_post.id,
            user_id=test_user_2.id,
            content="Parent comment"
        )
        reply = Comment(
            id=str(uuid.uuid4()),
            post_id=test_post.id,
            user_id=test_user_3.id,
            parent_comment_id=parent.id,
            content="Reply comment"
        )
        db_session.add_all([parent, reply])
        await db_session.commit()

        service = ReactionService(db_session)
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code="heart",
            object_type="comment",
            object_id=reply.id
        )

        result = await db_session.execute(select(Notification))
        notifications = result.scalars().all()

        assert len(notifications) == 1
        assert notifications[0].user_id == test_user_3.id
        assert notifications[0].message == "reacted to your comment"
        assert notifications[0].data["comment_id"] == reply.id

    async def test_comment_reaction_update_does_not_duplicate_notification(self, db_session: AsyncSession, test_user: User, test_user_2: User, test_post: Post):
        """Changing an existing comment reaction should not generate another notification."""
        comment = Comment(
            id=str(uuid.uuid4()),
            post_id=test_post.id,
            user_id=test_user_2.id,
            content="A thoughtful comment"
        )
        db_session.add(comment)
        await db_session.commit()

        service = ReactionService(db_session)
        await service.add_reaction(test_user.id, test_post.id, "heart", object_type="comment", object_id=comment.id)
        await service.add_reaction(test_user.id, test_post.id, "fire", object_type="comment", object_id=comment.id)

        result = await db_session.execute(select(Notification))
        notifications = result.scalars().all()

        assert len(notifications) == 1
        assert notifications[0].data["emoji_code"] == "heart"

    async def test_comment_reaction_suppresses_self_notification(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Reacting to your own comment should not create a notification."""
        comment = Comment(
            id=str(uuid.uuid4()),
            post_id=test_post.id,
            user_id=test_user.id,
            content="My own comment"
        )
        db_session.add(comment)
        await db_session.commit()

        service = ReactionService(db_session)
        await service.add_reaction(test_user.id, test_post.id, "heart", object_type="comment", object_id=comment.id)

        result = await db_session.execute(select(Notification))
        assert result.scalars().all() == []
