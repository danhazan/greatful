import asyncio
import logging
import os
import sys

# Add app to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.core.database import async_session
from app.repositories.user_repository import UserRepository
from app.repositories.follow_repository import FollowRepository
from app.repositories.post_repository import PostRepository
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.post import Post

# Set up logging to see our instrumentation output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("verify_script")

async def verify_optimizations():
    logger.info("=== Starting Batch Optimization Verification ===")
    from app.core.database import get_db
    
    # 0. Find some real author IDs to test with
    async for session in get_db():
        users_res = await session.execute(select(Post.author_id).limit(10).distinct())
        author_ids = [row[0] for row in users_res.fetchall()]
        
    if not author_ids:
        logger.warning("No users found in database, using mock IDs [1, 2]")
        author_ids = [1, 2]
            
    # 1. Test User Stats Batch (Expected: 1 SQL statement)
    logger.info("--- PHASE 1: Testing UserRepository.get_user_stats_batch ---")
    async for session in get_db():
        user_repo = UserRepository(session)
        await user_repo.get_user_stats_batch(author_ids)

    # 2. Test Follow Status Batch (Expected: 1 SQL statement)
    logger.info("--- PHASE 2: Testing FollowRepository.bulk_check_following_status ---")
    async for session in get_db():
        follow_repo = FollowRepository(session)
        await follow_repo.bulk_check_following_status(1, author_ids)

    # 3. Test Full Feed Serialization (Expected: ~5-8 statements total)
    logger.info("--- PHASE 3: Testing PostRepository.serialize_posts_for_feed ---")
    async for session in get_db():
        post_repo = PostRepository(session)
        posts_res = await session.execute(
            select(Post).limit(5).options(selectinload(Post.author))
        )
        posts = posts_res.scalars().all()
        if posts:
            logger.info(f"Serializing {len(posts)} posts for user 1")
            serialized = await post_repo.serialize_posts_for_feed(posts, user_id=1)
            # Author data should contain stats and follow status
            sample = serialized[0]['author']
            logger.info(f"Sample author data: {sample.keys()}")
            logger.info(f"Is following present: {'is_following' in sample}")
        else:
            logger.warning("No posts found to serialize")

    # 4. Test Notifications Batch (Expected: ~2-3 statements total)
    logger.info("--- PHASE 4: Testing get_notifications batch resolution ---")
    async for session in get_db():
        from app.services.notification_service import NotificationService
        from app.api.v1.notifications import get_notifications
        from app.models.notification import Notification
        
        # Use an existing user if possible
        test_user_id = author_ids[0] if author_ids else 1
        logger.info(f"Testing notifications for User ID: {test_user_id}")

        # Ensure test user has at least one notification
        res = await session.execute(select(Notification).where(Notification.user_id == test_user_id).limit(1))
        if not res.fetchone():
            logger.info(f"Seeding test notification for User {test_user_id}...")
            # distinct author ID to test resolution
            actor_id = author_ids[1] if len(author_ids) > 1 else (author_ids[0] if author_ids else 2)
            if actor_id == test_user_id: 
                 actor_id = test_user_id + 1 # simplistic fallback to ensure different user

            new_notif = Notification(
                user_id=test_user_id,
                type="like",
                title="Test Notification",
                message="Someone liked your post",
                data={"actor_user_id": actor_id, "actor_username": "testuser", "post_id": "test_post"},
                read=False
            )
            session.add(new_notif)
            await session.commit()
            logger.info(f"Seeded test notification for User {test_user_id}")

        try:
            # Test the optimized API endpoint logic
            # Explicitly pass all arguments to avoid Query object defaults when calling directly
            res = await get_notifications(
                current_user_id=test_user_id, 
                limit=10, 
                offset=0, 
                unread_only=False, 
                db=session
            )
            logger.info(f"Successfully processed {len(res)} notifications")
            if len(res) > 0:
                logger.info(f"Sample notification from_user: {res[0].from_user['username']}")
                logger.info(f"From user keys: {res[0].from_user.keys()}")
        except Exception as e:
            logger.exception(f"Error testing notifications: {e}")

    logger.info("=== Verification Complete. Analyze logs above for Session IDs and Statement Counts ===")

if __name__ == "__main__":
    asyncio.run(verify_optimizations())
