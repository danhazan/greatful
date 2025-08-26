"""
Integration tests for notification batching API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification
from app.models.user import User
from app.models.post import Post
from app.models.emoji_reaction import EmojiReaction
from app.services.notification_service import NotificationService
import datetime


@pytest.mark.asyncio
async def test_notification_batching_flow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    test_post: Post,
    auth_headers: dict
):
    """Test complete notification batching flow."""
    
    # Create first emoji reaction (should create single notification)
    reaction1 = EmojiReaction(
        user_id=test_user_2.id,
        post_id=test_post.id,
        emoji_code='heart_eyes'
    )
    db_session.add(reaction1)
    await db_session.commit()
    
    # Create notification for first reaction
    notification1 = await NotificationService.create_emoji_reaction_notification(
        db_session, test_user.id, test_user_2.username, 'heart_eyes', test_post.id
    )
    
    assert notification1 is not None
    assert notification1.is_batch == False
    assert notification1.batch_count == 1
    assert notification1.parent_id is None
    
    # Create second emoji reaction (should convert to batch)
    reaction2 = EmojiReaction(
        user_id=test_user_3.id,
        post_id=test_post.id,
        emoji_code='pray'
    )
    db_session.add(reaction2)
    await db_session.commit()
    
    # Create notification for second reaction
    notification2 = await NotificationService.create_emoji_reaction_notification(
        db_session, test_user.id, test_user_3.username, 'pray', test_post.id
    )
    
    # Refresh the first notification to see changes
    await db_session.refresh(notification1)
    
    # First notification should now be a batch
    assert notification1.is_batch == True
    assert notification1.batch_count == 2
    assert notification1.title == "New Reactions"
    assert notification1.message == "2 people reacted to your post"
    
    # Second notification should be a child
    assert notification2.parent_id == notification1.id
    assert notification2.is_batch == False
    
    # Test API: Get notifications (should only return parent)
    response = await async_client.get("/api/v1/notifications", headers=auth_headers)
    assert response.status_code == 200
    
    notifications = response.json()
    assert len(notifications) == 1  # Only parent notification
    
    batch_notification = notifications[0]
    assert batch_notification['is_batch'] == True
    assert batch_notification['batch_count'] == 2
    assert batch_notification['parent_id'] is None
    
    # Test API: Get batch children
    response = await async_client.get(
        f"/api/v1/notifications/{notification1.id}/children",
        headers=auth_headers
    )
    assert response.status_code == 200
    
    children = response.json()
    assert len(children) == 1  # One child notification
    assert children[0]['parent_id'] == notification1.id
    assert children[0]['is_batch'] == False
    
    # Test unread count (should only count parent)
    unread_count = await NotificationService.get_unread_count(db_session, test_user.id)
    assert unread_count == 1  # Only parent notification counts
    
    # Test marking batch as read (should mark children too)
    response = await async_client.post(
        f"/api/v1/notifications/{notification1.id}/read",
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # Refresh notifications
    await db_session.refresh(notification1)
    await db_session.refresh(notification2)
    
    # Both should be marked as read
    assert notification1.read == True
    assert notification2.read == True
    
    # Unread count should be 0
    unread_count = await NotificationService.get_unread_count(db_session, test_user.id)
    assert unread_count == 0


@pytest.mark.asyncio
async def test_add_to_existing_batch(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    test_post: Post,
    auth_headers: dict
):
    """Test adding notification to existing batch."""
    
    # Create a batch notification manually
    batch = Notification(
        user_id=test_user.id,
        type='emoji_reaction',
        title='New Reactions',
        message='2 people reacted to your post',
        data={'post_id': test_post.id},
        is_batch=True,
        batch_count=2,
        batch_key=f"emoji_reaction_{test_user.id}_{test_post.id}"
    )
    db_session.add(batch)
    await db_session.commit()
    
    # Create new reaction notification (should add to existing batch)
    new_notification = await NotificationService.create_emoji_reaction_notification(
        db_session, test_user.id, test_user_2.username, 'star', test_post.id
    )
    
    # Refresh batch
    await db_session.refresh(batch)
    
    # Batch should be updated
    assert batch.batch_count == 3
    assert batch.message == "3 people reacted to your post"
    
    # New notification should be a child
    assert new_notification.parent_id == batch.id
    
    # Test API: Get batch children should return the new child
    response = await async_client.get(
        f"/api/v1/notifications/{batch.id}/children",
        headers=auth_headers
    )
    assert response.status_code == 200
    
    children = response.json()
    assert len(children) == 1
    assert children[0]['id'] == new_notification.id


@pytest.mark.asyncio
async def test_different_post_notifications_separate_batches(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers: dict
):
    """Test that notifications for different posts create separate batches."""
    
    # Create two posts
    post1 = Post(
        id="post-1",
        author_id=test_user.id,
        content="First post",
        post_type="spontaneous"
    )
    post2 = Post(
        id="post-2", 
        author_id=test_user.id,
        content="Second post",
        post_type="spontaneous"
    )
    db_session.add_all([post1, post2])
    await db_session.commit()
    
    # Create notifications for both posts
    notification1 = await NotificationService.create_emoji_reaction_notification(
        db_session, test_user.id, test_user_2.username, 'heart_eyes', post1.id
    )
    notification2 = await NotificationService.create_emoji_reaction_notification(
        db_session, test_user.id, test_user_2.username, 'heart_eyes', post2.id
    )
    
    # Should create separate single notifications (different batch keys)
    assert notification1.batch_key != notification2.batch_key
    assert notification1.is_batch == False
    assert notification2.is_batch == False
    assert notification1.parent_id is None
    assert notification2.parent_id is None
    
    # Test API: Should return both notifications
    response = await async_client.get("/api/v1/notifications", headers=auth_headers)
    assert response.status_code == 200
    
    notifications = response.json()
    assert len(notifications) == 2


@pytest.mark.asyncio
async def test_batch_children_security(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    auth_headers: dict,
    auth_headers_2: dict
):
    """Test that users can only access their own batch children."""
    
    # Create batch notification for test_user
    batch = Notification(
        user_id=test_user.id,
        type='emoji_reaction',
        title='New Reactions',
        message='2 people reacted to your post',
        is_batch=True,
        batch_count=2
    )
    db_session.add(batch)
    await db_session.commit()
    
    # Try to access batch children as different user
    response = await async_client.get(
        f"/api/v1/notifications/{batch.id}/children",
        headers=auth_headers_2  # Different user's auth
    )
    assert response.status_code == 200
    
    children = response.json()
    assert len(children) == 0  # Should return empty list for other user's batch


@pytest.mark.asyncio
async def test_mark_all_as_read_with_batches(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_post: Post,
    auth_headers: dict
):
    """Test mark all as read with batch notifications."""
    
    # Create batch with children
    batch = Notification(
        user_id=test_user.id,
        type='emoji_reaction',
        title='New Reactions',
        message='2 people reacted to your post',
        is_batch=True,
        batch_count=2,
        read=False
    )
    db_session.add(batch)
    await db_session.commit()
    
    child1 = Notification(
        user_id=test_user.id,
        type='emoji_reaction',
        title='New Reaction',
        message='user2 reacted with 😍 to your post',
        parent_id=batch.id,
        read=False
    )
    child2 = Notification(
        user_id=test_user.id,
        type='emoji_reaction',
        title='New Reaction',
        message='user3 reacted with 🙏 to your post',
        parent_id=batch.id,
        read=False
    )
    db_session.add_all([child1, child2])
    await db_session.commit()
    
    # Test API: Mark all as read
    response = await async_client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert response.status_code == 200
    
    result = response.json()
    assert result['success'] == True
    assert result['marked_count'] == 1  # Only parent notification counts
    
    # Refresh all notifications
    await db_session.refresh(batch)
    await db_session.refresh(child1)
    await db_session.refresh(child2)
    
    # All should be marked as read
    assert batch.read == True
    assert child1.read == True
    assert child2.read == True


@pytest.mark.asyncio
async def test_notification_batching_time_window(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_post: Post
):
    """Test that old notifications don't get batched together."""
    
    # Create old notification (more than 1 hour ago)
    old_time = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2)
    old_time = old_time.replace(tzinfo=None)
    
    old_notification = Notification(
        user_id=test_user.id,
        type='emoji_reaction',
        title='New Reaction',
        message='user2 reacted with 😍 to your post',
        data={'post_id': test_post.id, 'reactor_username': test_user_2.username},
        created_at=old_time,
        batch_key=f"emoji_reaction_{test_user.id}_{test_post.id}"
    )
    db_session.add(old_notification)
    await db_session.commit()
    
    # Create new notification (should not batch with old one)
    new_notification = await NotificationService.create_emoji_reaction_notification(
        db_session, test_user.id, test_user_2.username, 'pray', test_post.id
    )
    
    # Should create separate notification, not batch with old one
    assert new_notification.is_batch == False
    assert new_notification.parent_id is None
    assert old_notification.is_batch == False  # Old one should remain unchanged
    
    # Should have 2 separate notifications
    notifications = await NotificationService.get_user_notifications(db_session, test_user.id)
    assert len(notifications) == 2