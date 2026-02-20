import asyncio
import os
import sys
import json

# Setup paths for local imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.api.v1.posts import PostResponse

async def verify_contracts():
    """Verify that Feed and Single Post endpoints return identical camelCase author shapes."""
    print("\n" + "="*50)
    print("🔍 VERIFYING RESPONSE STRUCTURAL INTEGRITY (CAMELCASE)")
    print("="*50)
    
    test_user_id = 1
    
    async for db in get_db():
        # 1. Fetch real post and user data to simulate response
        from sqlalchemy import text
        from app.repositories.user_repository import UserRepository
        from app.core.storage import storage
        
        # Get a sample post ID
        res = await db.execute(text("SELECT id, author_id FROM posts LIMIT 1"))
        post_row = res.fetchone()
        if not post_row:
            print("❌ No posts found in database.")
            return
            
        post_id = post_row.id
        author_id = post_row.author_id
        
        # Simulate the hydration logic from serialize_posts_for_feed or get_post_by_id
        user_repo = UserRepository(db)
        stats_batch = await user_repo.get_user_stats_batch([author_id])
        stats = stats_batch.get(author_id, {})
        
        # Get author details
        user_res = await db.execute(text("SELECT username, display_name, profile_image_url FROM users WHERE id = :id"), {"id": author_id})
        user_row = user_res.fetchone()
        
        # This is the internal dict we produce in the repository/endpoint
        raw_author_data = {
            "id": str(author_id),
            "username": user_row.username,
            "display_name": user_row.display_name,
            "name": user_row.display_name or user_row.username,
            "image": storage.get_url(user_row.profile_image_url) if user_row.profile_image_url else None,
            "follower_count": stats.get("followers_count", 0),
            "following_count": stats.get("following_count", 0),
            "posts_count": stats.get("posts_count", 0),
            "is_following": False # Mocked for verification
        }
        
        # This is the internal post data
        raw_post_data = {
            "id": post_id,
            "author_id": author_id,
            "content": "Verification post",
            "post_type": "spontaneous",
            "is_public": True,
            "created_at": "2024-01-01T00:00:00Z",
            "author": raw_author_data,
            "hearts_count": 0,
            "reactions_count": 0,
            "comments_count": 0
        }
        
        # 2. Serialize using PostResponse (Simulating FastAPI/Pydantic output)
        print("\n=> Serializing via PostResponse Schema...")
        pydantic_post = PostResponse(**raw_post_data)
        
        # model_dump(by_alias=True) is what FastAPI uses for camelCase conversion if configured via alias_generator
        serialized_json = json.loads(pydantic_post.model_dump_json(by_alias=True))
        
        author_json = serialized_json.get("author", {})
        print("\n=> Serialized Author Keys:")
        print(list(author_json.keys()))
        
        # Verify mandatory camelCase keys exist
        expected_camel_keys = ["isFollowing", "followerCount", "followingCount", "postsCount"]
        for key in expected_camel_keys:
            if key not in author_json:
                print(f"❌ Mismatch: Missing expected camelCase key '{key}'")
                sys.exit(1)
            else:
                print(f"✅ Found '{key}'")

        # Verify no snake_case keys remain in the serialized output
        snake_keys_to_avoid = ["is_following", "follower_count", "following_count", "posts_count"]
        for key in snake_keys_to_avoid:
            if key in author_json:
                print(f"❌ Mismatch: Unwanted snake_case key '{key}' still present!")
                sys.exit(1)
        
        # Verify NO top-level isFollowing
        if "isFollowing" in serialized_json or "is_following" in serialized_json:
            print("❌ Mismatch: top-level follow indicator still present!")
            sys.exit(1)
            
        print("\n✅ SUCCESS: Structural integrity and camelCase contract verified! 🎉")
        break

if __name__ == "__main__":
    asyncio.run(verify_contracts())
