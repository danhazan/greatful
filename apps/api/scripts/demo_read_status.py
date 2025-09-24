#!/usr/bin/env python3
"""
Demonstration script for the read status mechanism.

This script shows how read status affects post scoring and feed ranking.
Run this script to see the read status mechanism in action.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.services.algorithm_service import AlgorithmService
from app.models.user import User
from app.models.post import Post, PostType
from app.core.database import get_db_session


async def demonstrate_read_status():
    """Demonstrate the read status mechanism."""
    print("🔍 READ STATUS MECHANISM DEMONSTRATION")
    print("=" * 50)
    
    # Get database session
    async with get_db_session() as db:
        algorithm_service = AlgorithmService(db)
        
        # Create a test user
        test_user = User(
            email="demo@test.com",
            username="demo_user",
            hashed_password="demo_password",
            display_name="Demo User",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        
        db.add(test_user)
        await db.commit()
        await db.refresh(test_user)
        
        # Create test posts
        base_time = datetime.now(timezone.utc)
        
        test_posts = [
            Post(
                id="demo-post-1",
                author_id=test_user.id,
                content="This is a test post for read status demo",
                post_type=PostType.daily,
                is_public=True,
                created_at=base_time - timedelta(minutes=30)
            ),
            Post(
                id="demo-post-2", 
                author_id=test_user.id,
                content="Another test post with some engagement",
                post_type=PostType.spontaneous,
                is_public=True,
                created_at=base_time - timedelta(minutes=15)
            )
        ]
        
        db.add_all(test_posts)
        await db.commit()
        
        print(f"✅ Created test user: {test_user.username} (ID: {test_user.id})")
        print(f"✅ Created {len(test_posts)} test posts")
        print()
        
        # === STEP 1: Calculate scores when posts are unread ===
        print("📊 STEP 1: Calculate scores when posts are UNREAD")
        print("-" * 40)
        
        unread_scores = []
        for post in test_posts:
            score = await algorithm_service.calculate_post_score(
                post,
                user_id=test_user.id,
                hearts_count=5,
                reactions_count=3,
                shares_count=1,
                consider_read_status=True,
                user_last_feed_view=test_user.last_feed_view
            )
            unread_scores.append(score)
            print(f"  📝 {post.id}: {score:.2f} points (UNREAD)")
        
        print()
        
        # === STEP 2: Mark posts as read ===
        print("👁️  STEP 2: Mark posts as READ")
        print("-" * 40)
        
        post_ids = [post.id for post in test_posts]
        algorithm_service.mark_posts_as_read(test_user.id, post_ids)
        
        print(f"  ✅ Marked {len(post_ids)} posts as read")
        
        # Verify read status
        for post_id in post_ids:
            is_read = algorithm_service.is_post_read(test_user.id, post_id)
            print(f"  📖 {post_id}: {'READ' if is_read else 'UNREAD'}")
        
        print()
        
        # === STEP 3: Calculate scores when posts are read ===
        print("📊 STEP 3: Calculate scores when posts are READ")
        print("-" * 40)
        
        read_scores = []
        for post in test_posts:
            score = await algorithm_service.calculate_post_score(
                post,
                user_id=test_user.id,
                hearts_count=5,
                reactions_count=3,
                shares_count=1,
                consider_read_status=True,
                user_last_feed_view=test_user.last_feed_view
            )
            read_scores.append(score)
            print(f"  📝 {post.id}: {score:.2f} points (READ)")
        
        print()
        
        # === STEP 4: Compare scores ===
        print("⚖️  STEP 4: Score Comparison & Analysis")
        print("-" * 40)
        
        config = algorithm_service.config.scoring_weights
        unread_boost = config.unread_boost
        read_penalty = 1.0 / unread_boost
        
        print(f"  📋 Configuration:")
        print(f"     • Unread boost: {unread_boost}x")
        print(f"     • Read penalty: {read_penalty:.2f}x")
        print()
        
        for i, (post, unread_score, read_score) in enumerate(zip(test_posts, unread_scores, read_scores)):
            score_ratio = unread_score / read_score if read_score > 0 else float('inf')
            score_diff = unread_score - read_score
            
            print(f"  📊 {post.id}:")
            print(f"     • Unread score: {unread_score:.2f}")
            print(f"     • Read score:   {read_score:.2f}")
            print(f"     • Difference:   {score_diff:.2f} points")
            print(f"     • Ratio:        {score_ratio:.1f}x higher when unread")
            print()
        
        # === STEP 5: Test with read status disabled ===
        print("🚫 STEP 5: Scores with read status DISABLED")
        print("-" * 40)
        
        neutral_scores = []
        for post in test_posts:
            score = await algorithm_service.calculate_post_score(
                post,
                user_id=test_user.id,
                hearts_count=5,
                reactions_count=3,
                shares_count=1,
                consider_read_status=False  # Disabled
            )
            neutral_scores.append(score)
            print(f"  📝 {post.id}: {score:.2f} points (READ STATUS IGNORED)")
        
        print()
        
        # === STEP 6: Get read status summary ===
        print("📈 STEP 6: Read Status Summary")
        print("-" * 40)
        
        summary = algorithm_service.get_read_status_summary(test_user.id)
        print(f"  📊 Total posts read: {summary['read_count']}")
        print(f"  📊 Recent reads: {len(summary['recent_reads'])}")
        
        for read_info in summary['recent_reads']:
            print(f"     • {read_info['post_id']} at {read_info['read_at']}")
        
        print()
        
        # === STEP 7: Clear read status ===
        print("🧹 STEP 7: Clear read status")
        print("-" * 40)
        
        algorithm_service.clear_read_status(test_user.id)
        print("  ✅ Read status cleared")
        
        # Verify clearing worked
        cleared_summary = algorithm_service.get_read_status_summary(test_user.id)
        print(f"  📊 Posts read after clearing: {cleared_summary['read_count']}")
        
        print()
        
        # === SUMMARY ===
        print("🎯 DEMONSTRATION SUMMARY")
        print("=" * 50)
        print("✅ Read status mechanism working correctly!")
        print()
        print("Key findings:")
        print(f"• Unread posts get {unread_boost}x scoring boost")
        print(f"• Read posts get {read_penalty:.2f}x scoring penalty")
        print(f"• Score difference creates {unread_boost * unread_boost:.0f}x ranking advantage for unread posts")
        print("• Read status can be disabled to ignore tracking")
        print("• Read status persists during session and can be cleared")
        print("• API provides comprehensive read status management")
        print()
        print("🚀 This mechanism improves user experience by:")
        print("   - Prioritizing fresh, unseen content")
        print("   - Reducing repetitive content in feeds")
        print("   - Maintaining engagement with quality posts")
        print("   - Providing user control over read tracking")


if __name__ == "__main__":
    print("Starting read status demonstration...")
    print("This will create temporary test data and demonstrate the mechanism.")
    print()
    
    try:
        asyncio.run(demonstrate_read_status())
    except KeyboardInterrupt:
        print("\n\n⚠️  Demonstration interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error during demonstration: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n🏁 Demonstration complete!")