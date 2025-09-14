#!/usr/bin/env python3
"""
Script to simulate user interactions for testing the preference system.
This will create some sample interactions between users.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import async_session
from app.services.user_preference_service import UserPreferenceService
from app.models.user import User
from app.models.post import Post
from sqlalchemy.future import select
import random


async def simulate_interactions():
    """Create sample interactions between users."""
    
    async with async_session() as db:
        preference_service = UserPreferenceService(db)
        
        print("=== SIMULATING USER INTERACTIONS ===\n")
        
        # Get users and posts
        users_result = await db.execute(select(User).limit(5))
        users = users_result.scalars().all()
        
        posts_result = await db.execute(select(Post).limit(10))
        posts = posts_result.scalars().all()
        
        if len(users) < 2:
            print("Need at least 2 users to simulate interactions")
            return
            
        if len(posts) < 1:
            print("Need at least 1 post to simulate interactions")
            return
        
        print(f"Found {len(users)} users and {len(posts)} posts")
        
        # Simulate interactions between first two users
        user1 = users[0]  # Satan
        user2 = users[1]  # Carina H
        
        print(f"Simulating interactions between {user1.username} and {user2.username}")
        
        # Create some interactions from user1 to user2's posts
        user2_posts = [p for p in posts if p.author_id == user2.id]
        
        if user2_posts:
            for post in user2_posts[:3]:  # Interact with up to 3 posts
                # Simulate heart interaction
                await preference_service.track_heart_interaction(
                    user_id=user1.id,
                    post_author_id=user2.id,
                    post_id=post.id
                )
                print(f"  ❤️ {user1.username} hearted {user2.username}'s post")
                
                # Sometimes add a reaction too
                if random.random() > 0.5:
                    await preference_service.track_reaction_interaction(
                        user_id=user1.id,
                        post_author_id=user2.id,
                        post_id=post.id
                    )
                    print(f"  😍 {user1.username} reacted to {user2.username}'s post")
        
        # Simulate follow interaction
        await preference_service.track_follow_interaction(
            user_id=user1.id,
            followed_user_id=user2.id
        )
        print(f"  👥 {user1.username} followed {user2.username}")
        
        # Create interactions in reverse direction too
        user1_posts = [p for p in posts if p.author_id == user1.id]
        
        if user1_posts:
            for post in user1_posts[:2]:  # Fewer interactions back
                await preference_service.track_heart_interaction(
                    user_id=user2.id,
                    post_author_id=user1.id,
                    post_id=post.id
                )
                print(f"  ❤️ {user2.username} hearted {user1.username}'s post")
        
        # Commit the interactions
        await db.commit()
        
        print(f"\n✅ Interactions simulated successfully!")
        
        # Show the results
        print(f"\n=== INTERACTION SUMMARY ===")
        summary1 = await preference_service.get_interaction_summary(user1.id)
        summary2 = await preference_service.get_interaction_summary(user2.id)
        
        print(f"{user1.username}: {summary1['total_interactions']} total interactions")
        print(f"{user2.username}: {summary2['total_interactions']} total interactions")
        
        # Test preference boost
        boost1to2 = await preference_service.calculate_preference_boost(user1.id, user2.id)
        boost2to1 = await preference_service.calculate_preference_boost(user2.id, user1.id)
        
        print(f"\nPreference boosts:")
        print(f"  {user1.username} → {user2.username}: {boost1to2:.2f}x")
        print(f"  {user2.username} → {user1.username}: {boost2to1:.2f}x")
        
        if boost1to2 > 1.0 or boost2to1 > 1.0:
            print(f"🎉 Preference system is now working!")
        else:
            print(f"⚠️ Preference boosts still not applied - may need more interactions")


if __name__ == "__main__":
    asyncio.run(simulate_interactions())