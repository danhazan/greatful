"""
Tests for notification integration with reactions.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.reaction_service import ReactionService
from app.services.notification_service import NotificationService
from app.models.user import User
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.notification import Notification
from app.core.exceptions import ValidationException


class TestNotificationIntegration:
    """Test notification creation when reactions are added."""

    @pytest.mark.asyncio
    async def test_reaction_creates_notification(self, db_session: AsyncSession):
        """Test that adding a reaction creates a notification for the post author."""
        # Create two users - one post author, one reactor
        author = User(
            email="author@example.com",
            username="author",
            hashed_password="hashed_password"
        )
        reactor = User(
            email="reactor@example.com", 
            username="reactor",
            hashed_password="hashed_password"
        )
        
        db_session.add(author)
        db_session.add(reactor)
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor)

        # Create a post by the author
        post = Post(
            id="test-post-1",
            author=author,
            content="Test gratitude post"
        )
        db_session.add(post)
        await db_session.flush()

        # Add a reaction from the reactor
        reaction_service = ReactionService(db_session)
        reaction_data = await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        assert reaction_data is not None
        assert reaction_data["emoji_code"] == "heart_eyes"

        # Check that a notification was created for the author
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        notification = notifications[0]
        assert notification.type == "emoji_reaction"
        assert notification.user_id == author.id
        assert "reacted to your post" in notification.message
        assert "😍" in notification.message
        assert notification.data["post_id"] == post.id
        assert notification.data["emoji_code"] == "heart_eyes"
        assert notification.data["reactor_username"] == "reactor"
        assert not notification.read

    @pytest.mark.asyncio
    async def test_image_reaction_requires_object_id(self, db_session: AsyncSession):
        """Test that image reactions require an image object id."""
        author = User(email="image-author-missing@example.com", username="imageauthormissing", hashed_password="hashed_password")
        reactor = User(email="image-reactor-missing@example.com", username="imagereactormissing", hashed_password="hashed_password")
        db_session.add_all([author, reactor])
        await db_session.commit()

        post = Post(id="image-post-missing-object", author=author, content="Test post")
        db_session.add(post)
        await db_session.commit()

        reaction_service = ReactionService(db_session)
        with pytest.raises(ValidationException):
            await reaction_service.add_reaction(
                user_id=reactor.id,
                post_id=post.id,
                emoji_code="heart_eyes",
                object_type="image"
            )

    @pytest.mark.asyncio
    async def test_image_reaction_requires_image_to_belong_to_post(self, db_session: AsyncSession):
        """Test that image reaction targets must belong to the provided post."""
        author = User(email="image-author-wrong-post@example.com", username="imageauthorwrongpost", hashed_password="hashed_password")
        reactor = User(email="image-reactor-wrong-post@example.com", username="imagereactorwrongpost", hashed_password="hashed_password")
        db_session.add_all([author, reactor])
        await db_session.commit()

        post = Post(id="image-post-target", author=author, content="Target post")
        other_post = Post(id="image-post-other", author=author, content="Other post")
        image = PostImage(
            id="image-from-other-post",
            post_id=other_post.id,
            position=0,
            thumbnail_url="/uploads/posts/other_thumb.jpg",
            medium_url="/uploads/posts/other_medium.jpg",
            original_url="/uploads/posts/other_original.jpg"
        )
        db_session.add_all([post, other_post, image])
        await db_session.commit()

        reaction_service = ReactionService(db_session)
        with pytest.raises(ValidationException):
            await reaction_service.add_reaction(
                user_id=reactor.id,
                post_id=post.id,
                emoji_code="heart_eyes",
                object_type="image",
                object_id=image.id
            )

    @pytest.mark.asyncio
    async def test_image_reaction_creates_notification_with_object_metadata(self, db_session: AsyncSession):
        """Test that image reactions create reaction notifications with flat object metadata."""
        author = User(email="image-author@example.com", username="imageauthor", hashed_password="hashed_password")
        reactor = User(email="image-reactor@example.com", username="imagereactor", hashed_password="hashed_password")
        db_session.add_all([author, reactor])
        await db_session.commit()

        post = Post(id="image-post-1", author=author, content="Post with an image")
        image = PostImage(
            id="image-1",
            post_id=post.id,
            position=0,
            thumbnail_url="/uploads/posts/image_thumb.jpg",
            medium_url="/uploads/posts/image_medium.jpg",
            original_url="/uploads/posts/image_original.jpg"
        )
        db_session.add_all([post, image])
        await db_session.commit()

        reaction_service = ReactionService(db_session)
        reaction_data = await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes",
            object_type="image",
            object_id=image.id
        )

        assert reaction_data["object_type"] == "image"
        assert reaction_data["object_id"] == image.id

        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        notification = notifications[0]
        assert notification.type == "emoji_reaction"
        assert notification.message == "reacted to an image in your post with 😍"
        assert notification.batch_key == f"post_interaction:post:{post.id}"
        assert notification.data["post_id"] == post.id
        assert notification.data["object_type"] == "image"
        assert notification.data["object_id"] == image.id
        assert notification.data["target"] == "post"
        assert notification.data["thumbnail_type"] == "image"
        assert notification.data["thumbnail_url"] == image.thumbnail_url

    @pytest.mark.asyncio
    async def test_post_and_image_reactions_share_existing_post_batch(self, db_session: AsyncSession):
        """Test mixed post/image reactions keep current post-level batching."""
        author = User(email="mixed-author@example.com", username="mixedauthor", hashed_password="hashed_password")
        post_reactor = User(email="mixed-post-reactor@example.com", username="mixedpostreactor", hashed_password="hashed_password")
        image_reactor = User(email="mixed-image-reactor@example.com", username="mixedimagereactor", hashed_password="hashed_password")
        db_session.add_all([author, post_reactor, image_reactor])
        await db_session.commit()

        post = Post(id="mixed-post-1", author=author, content="Post with image")
        image = PostImage(
            id="mixed-image-1",
            post_id=post.id,
            position=0,
            thumbnail_url="/uploads/posts/mixed_thumb.jpg",
            medium_url="/uploads/posts/mixed_medium.jpg",
            original_url="/uploads/posts/mixed_original.jpg"
        )
        db_session.add_all([post, image])
        await db_session.commit()

        reaction_service = ReactionService(db_session)
        await reaction_service.add_reaction(
            user_id=post_reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )
        await reaction_service.add_reaction(
            user_id=image_reactor.id,
            post_id=post.id,
            emoji_code="clap",
            object_type="image",
            object_id=image.id
        )

        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        batch = notifications[0]
        assert batch.type == "post_interaction"
        assert batch.is_batch is True
        assert batch.batch_count == 2
        assert batch.batch_key == f"post_interaction:post:{post.id}"

        children = await NotificationService.get_batch_children(
            db=db_session,
            batch_id=batch.id,
            user_id=author.id
        )
        child_messages = {child.message for child in children}
        assert child_messages == {
            "reacted to your post with 😍",
            "reacted to an image in your post with 👏"
        }
        child_object_types = {child.data["object_type"] for child in children}
        assert child_object_types == {"post", "image"}

    @pytest.mark.asyncio
    async def test_self_reaction_no_notification(self, db_session: AsyncSession):
        """Test that reacting to your own post doesn't create a notification."""
        # Create a user
        user = User(
            email="user@example.com",
            username="user",
            hashed_password="hashed_password"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create a post by the user
        post = Post(
            id="test-post-2",
            author=user,
            content="Test gratitude post"
        )
        db_session.add(post)
        await db_session.commit()

        # Add a reaction from the same user (self-reaction)
        reaction_service = ReactionService(db_session)
        reaction_data = await reaction_service.add_reaction(
            user_id=user.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        assert reaction_data is not None
        assert reaction_data["emoji_code"] == "heart_eyes"

        # Check that no notification was created
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=user.id
        )

        assert len(notifications) == 0

    @pytest.mark.asyncio
    async def test_reaction_update_creates_notification(self, db_session: AsyncSession):
        """Test that updating a reaction creates a new notification."""
        # Create two users - one post author, one reactor
        author = User(
            email="author2@example.com",
            username="author2",
            hashed_password="hashed_password"
        )
        reactor = User(
            email="reactor2@example.com", 
            username="reactor2",
            hashed_password="hashed_password"
        )
        
        db_session.add(author)
        db_session.add(reactor)
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor)

        # Create a post by the author
        post = Post(
            id="test-post-3",
            author=author,
            content="Test gratitude post"
        )
        db_session.add(post)
        await db_session.commit()

        # Add initial reaction
        reaction_service = ReactionService(db_session)
        await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        # Update the reaction to a different emoji
        updated_reaction_data = await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="fire"
        )

        assert updated_reaction_data["emoji_code"] == "fire"

        # Check that notifications were created with new batching behavior
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        # With new batching system, reaction updates create a single batch notification
        # Both reactions are batched together as post interactions
        assert len(notifications) == 1
        
        # Check the batch notification
        batch_notification = notifications[0]
        assert batch_notification.type == "post_interaction"
        assert batch_notification.is_batch == True
        assert batch_notification.batch_count == 2

    @pytest.mark.asyncio
    async def test_multiple_users_reactions_create_multiple_notifications(self, db_session: AsyncSession):
        """Test that reactions from multiple users create separate notifications."""
        # Create one author and two reactors
        author = User(
            email="author3@example.com",
            username="author3",
            hashed_password="hashed_password"
        )
        reactor1 = User(
            email="reactor3@example.com", 
            username="reactor3",
            hashed_password="hashed_password"
        )
        reactor2 = User(
            email="reactor4@example.com", 
            username="reactor4",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([author, reactor1, reactor2])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor1)
        await db_session.refresh(reactor2)

        # Create a post by the author
        post = Post(
            id="test-post-4",
            author=author,
            content="Test gratitude post"
        )
        db_session.add(post)
        await db_session.commit()

        # Add reactions from both reactors
        reaction_service = ReactionService(db_session)
        await reaction_service.add_reaction(
            user_id=reactor1.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        await reaction_service.add_reaction(
            user_id=reactor2.id,
            post_id=post.id,
            emoji_code="pray"
        )

        # Check that notifications were created with new batching behavior
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        # With new batching system, should have 1 batch notification with 2 children
        assert len(notifications) == 1
        
        # Check the batch notification
        batch_notification = notifications[0]
        assert batch_notification.type == "post_interaction"
        assert batch_notification.user_id == author.id
        assert not batch_notification.read
        assert batch_notification.is_batch == True
        assert batch_notification.batch_count == 2

    @pytest.mark.asyncio
    async def test_image_reaction_has_thumbnail_url_post_reaction_does_not(self, db_session: AsyncSession):
        """Regression: Image reactions should have thumbnail_url, post reactions should not."""
        author = User(email="thumb-author@example.com", username="thumbauthor", hashed_password="hashed_password")
        post_reactor = User(email="thumb-post-reactor@example.com", username="thumbreactor1", hashed_password="hashed_password")
        image_reactor = User(email="thumb-image-reactor@example.com", username="thumbreactor2", hashed_password="hashed_password")
        db_session.add_all([author, post_reactor, image_reactor])
        await db_session.commit()

        post = Post(id="thumb-post-1", author=author, content="Post with image")
        image = PostImage(
            id="thumb-image-1",
            post_id=post.id,
            position=0,
            thumbnail_url="/uploads/posts/thumb_test.jpg",
            medium_url="/uploads/posts/medium_test.jpg",
            original_url="/uploads/posts/original_test.jpg"
        )
        db_session.add_all([post, image])
        await db_session.commit()

        reaction_service = ReactionService(db_session)

        # Add post reaction
        await reaction_service.add_reaction(
            user_id=post_reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        # Add image reaction
        await reaction_service.add_reaction(
            user_id=image_reactor.id,
            post_id=post.id,
            emoji_code="clap",
            object_type="image",
            object_id=image.id
        )

        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        batch = notifications[0]
        assert batch.type == "post_interaction"
        assert batch.is_batch is True

        children = await NotificationService.get_batch_children(
            db=db_session,
            batch_id=batch.id,
            user_id=author.id
        )

        post_reaction_child = next(c for c in children if "reacted to your post with" in c.message and "image" not in c.message)
        image_reaction_child = next(c for c in children if "reacted to an image in your post" in c.message)

        assert post_reaction_child.data.get("thumbnail_type") is None
        assert post_reaction_child.data.get("thumbnail_url") is None

        assert image_reaction_child.data.get("thumbnail_type") == "image"
        assert image_reaction_child.data.get("thumbnail_url") == image.thumbnail_url

    @pytest.mark.asyncio
    async def test_post_reaction_never_has_thumbnail_fields(self, db_session: AsyncSession):
        """Regression: Post reactions must never include thumbnail_type or thumbnail_url."""
        author = User(email="post-only-author@example.com", username="postonlyauthor", hashed_password="hashed_password")
        reactor = User(email="post-only-reactor@example.com", username="postonlyreactor", hashed_password="hashed_password")
        db_session.add_all([author, reactor])
        await db_session.commit()

        post = Post(id="post-only-post-1", author=author, content="Just a post")
        db_session.add(post)
        await db_session.commit()

        reaction_service = ReactionService(db_session)
        await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="pray"
        )

        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        notification = notifications[0]

        assert "thumbnail_type" not in notification.data
        assert "thumbnail_url" not in notification.data
