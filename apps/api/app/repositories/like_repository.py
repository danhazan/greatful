"""
Like repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_
from app.core.repository_base import BaseRepository
from app.models.like import Like
from app.models.user import User


class LikeRepository(BaseRepository):
    """Repository for Like model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Like)
    
    async def get_user_like(
        self, 
        user_id: int, 
        post_id: str
    ) -> Optional[Like]:
        """
        Get a specific user's like on a post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            Optional[Like]: The user's like if it exists
        """
        return await self.find_one({
            "user_id": user_id,
            "post_id": post_id
        })
    
    async def get_post_likes(
        self, 
        post_id: str,
        load_users: bool = True,
        limit: int = 50,
        offset: int = 0
    ) -> List[Like]:
        """
        Get all likes for a specific post.
        
        Args:
            post_id: ID of the post
            load_users: Whether to load user relationships
            limit: Maximum number of likes
            offset: Number of likes to skip
            
        Returns:
            List[Like]: List of likes for the post
        """
        load_relationships = ["user"] if load_users else None
        
        builder = self.query().filter(Like.post_id == post_id)
        
        if load_relationships:
            builder = builder.load_relationships(*load_relationships)
        
        builder = builder.order_by(desc(Like.created_at)).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get post likes")
        return result.scalars().all()
    
    async def get_post_like_count(self, post_id: str) -> int:
        """
        Get total number of likes for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Total like count
        """
        return await self.count({"post_id": post_id})
    
    async def get_user_likes(
        self, 
        user_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> List[Like]:
        """
        Get all likes by a specific user.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of likes
            offset: Number of likes to skip
            
        Returns:
            List[Like]: List of user's likes
        """
        return await self.find_all(
            filters={"user_id": user_id},
            order_by=desc(Like.created_at)
        )
    
    async def get_like_analytics(
        self, 
        post_id: Optional[str] = None,
        user_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get like analytics for a post or user.
        
        Args:
            post_id: Optional post ID to filter by
            user_id: Optional user ID to filter by (for likes received)
            days: Number of days to look back
            
        Returns:
            Dict: Analytics data
        """
        where_conditions = ["l.created_at >= NOW() - INTERVAL :days DAY"]
        params = {"days": days}
        
        if post_id:
            where_conditions.append("l.post_id = :post_id")
            params["post_id"] = post_id
        
        if user_id:
            where_conditions.append("p.author_id = :user_id")
            params["user_id"] = user_id
        
        where_clause = " AND ".join(where_conditions)
        
        query = text(f"""
            SELECT 
                COUNT(DISTINCT l.id) as total_likes,
                COUNT(DISTINCT l.user_id) as unique_likers,
                COUNT(DISTINCT l.post_id) as posts_with_likes,
                AVG(daily_counts.daily_count) as avg_likes_per_day
            FROM likes l
            LEFT JOIN posts p ON p.id = l.post_id
            LEFT JOIN (
                SELECT 
                    DATE(l2.created_at) as like_date,
                    COUNT(*) as daily_count
                FROM likes l2
                LEFT JOIN posts p2 ON p2.id = l2.post_id
                WHERE {where_clause}
                GROUP BY DATE(l2.created_at)
            ) daily_counts ON 1=1
            WHERE {where_clause}
        """)
        
        result = await self.execute_raw_query(query, params)
        row = result.fetchone()
        
        if not row:
            return {
                "total_likes": 0,
                "unique_likers": 0,
                "posts_with_likes": 0,
                "avg_likes_per_day": 0.0
            }
        
        return {
            "total_likes": int(row.total_likes) if row.total_likes else 0,
            "unique_likers": int(row.unique_likers) if row.unique_likers else 0,
            "posts_with_likes": int(row.posts_with_likes) if row.posts_with_likes else 0,
            "avg_likes_per_day": float(row.avg_likes_per_day) if row.avg_likes_per_day else 0.0
        }
    
    async def get_most_liked_posts(
        self, 
        limit: int = 10,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get most liked posts in the last N days.
        
        Args:
            limit: Maximum number of posts to return
            days: Number of days to look back
            
        Returns:
            List[Dict]: List of posts with like counts
        """
        query = text("""
            SELECT 
                p.id,
                p.content,
                p.post_type,
                p.image_url,
                p.created_at,
                u.username as author_username,
                COUNT(l.id) as like_count
            FROM posts p
            LEFT JOIN users u ON u.id = p.author_id
            LEFT JOIN likes l ON l.post_id = p.id 
                AND l.created_at >= NOW() - INTERVAL :days DAY
            WHERE p.is_public = true
                AND p.created_at >= NOW() - INTERVAL :days DAY
            GROUP BY p.id, p.content, p.post_type, p.image_url, p.created_at, u.username
            HAVING like_count > 0
            ORDER BY like_count DESC, p.created_at DESC
            LIMIT :limit
        """)
        
        result = await self.execute_raw_query(query, {"days": days, "limit": limit})
        rows = result.fetchall()
        
        most_liked_posts = []
        for row in rows:
            most_liked_posts.append({
                "id": row.id,
                "content": row.content,
                "post_type": row.post_type,
                "image_url": row.image_url,
                "created_at": str(row.created_at),
                "author_username": row.author_username,
                "like_count": int(row.like_count)
            })
        
        return most_liked_posts
    
    async def check_user_liked_post(self, user_id: int, post_id: str) -> bool:
        """
        Check if a user has liked a specific post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            bool: True if user has liked the post, False otherwise
        """
        return await self.exists({
            "user_id": user_id,
            "post_id": post_id
        })
    
    async def delete_user_like(self, user_id: int, post_id: str) -> bool:
        """
        Delete a user's like from a post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            bool: True if like was deleted, False if no like existed
        """
        like = await self.get_user_like(user_id, post_id)
        
        if like:
            await self.delete(like)
            return True
        
        return False
    
    async def get_user_like_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Get like statistics for a user (likes given and received).
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict: User like statistics
        """
        # Likes given by user
        likes_given = await self.count({"user_id": user_id})
        
        # Likes received on user's posts
        query = text("""
            SELECT COUNT(DISTINCT l.id) as likes_received
            FROM likes l
            INNER JOIN posts p ON p.id = l.post_id
            WHERE p.author_id = :user_id
        """)
        
        result = await self.execute_raw_query(query, {"user_id": user_id})
        row = result.fetchone()
        likes_received = int(row.likes_received) if row and row.likes_received else 0
        
        return {
            "likes_given": likes_given,
            "likes_received": likes_received
        }