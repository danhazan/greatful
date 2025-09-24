#!/usr/bin/env python3
"""
Debug script to check preference system functionality.
Run this to see if interactions are being tracked and preferences are working.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import async_session
from app.services.user_preference_service import UserPreferenceService
from app.services.algorithm_service import AlgorithmService
from app.models.user import User
from app.models.post import Post
from app.models.user_interaction import UserInteraction
from sqlalchemy.future import select
from sqlalchemy import func, desc


async def debug_preference_system():
    """Debug the preference system to see what's happening."""
    
    async with async_session() as db:
        preference_service = UserPreferenceService(db)
        algorithm_service = AlgorithmService(db)
        
        print("=== PREFERENCE SYSTEM DEBUG ===\n")
        
        # Get all users
        users_result = await db.execute(select(User).limit(10))
        users = users_result.scalars().all()
        
        print(f"Found {len(users)} users:")
        for user in users:
            print(f"  - {user.username} (ID: {user.id})")
        
        if len(users) < 2:
            print("Need at least 2 users to debug preferences")
            return
        
        # Check interactions for first user
        user1 = users[0]
        print(f"\n=== INTERACTIONS FOR {user1.username} ===")
        
        # Get interaction summary
        summary = await preference_service.get_interaction_summary(user1.id)
        print(f"Total interactions: {summary['total_interactions']}")
        print(f"Recent interactions (7 days): {summary['recent_interactions']}")
        print(f"Frequent users count: {summary['frequent_users_count']}")
        
        if summary['interactions_by_type']:
            print("Interactions by type:")
            for interaction_type, stats in summary['interactions_by_type'].items():
                print(f"  - {interaction_type}: {stats['count']} interactions, weight: {stats['total_weight']}")
        
        # Get user preferences
        preferences = await preference_service.get_user_preferences(user1.id, limit=10)
        print(f"\nTop preferences for {user1.username}:")
        for pref in preferences:
            print(f"  - {pref['username']}: score {pref['preference_score']:.2f}, "
                  f"interactions: {pref['interaction_count']}, weight: {pref['total_weight']}")
        
        # Check if any interactions exist at all
        interactions_result = await db.execute(
            select(func.count(UserInteraction.id))
        )
        total_interactions = interactions_result.scalar() or 0
        print(f"\nTotal interactions in database: {total_interactions}")
        
        if total_interactions == 0:
            print("❌ NO INTERACTIONS FOUND! The preference system isn't tracking interactions.")
            print("This could be because:")
            print("1. Users haven't interacted with posts yet")
            print("2. The interaction tracking code isn't being called")
            print("3. There's an error in the interaction tracking")
        
        # Check recent posts and their scores
        posts_result = await db.execute(
            select(Post).order_by(desc(Post.created_at)).limit(5)
        )
        recent_posts = posts_result.scalars().all()
        
        print(f"\n=== RECENT POSTS AND ALGORITHM SCORES ===")
        for post in recent_posts:
            score = await algorithm_service.calculate_post_score(post, user1.id)
            print(f"Post by user {post.author_id}: '{post.content[:50]}...' - Score: {score:.2f}")
        
        # Test preference boost calculation
        if len(users) >= 2:
            user2 = users[1]
            boost = await preference_service.calculate_preference_boost(user1.id, user2.id)
            print(f"\nPreference boost from {user1.username} to {user2.username}: {boost:.2f}x")
        
        print("\n=== CONFIGURATION ===")
        config = algorithm_service.config
        print(f"Interaction threshold: {config.preference_factors.interaction_threshold}")
        print(f"Frequent user boost: {config.preference_factors.frequent_user_boost}")
        print(f"Max posts per author: {config.diversity_limits.max_posts_per_author}")
        print(f"Randomization factor: {config.diversity_limits.randomization_factor}")


if __name__ == "__main__":
    asyncio.run(debug_preference_system())