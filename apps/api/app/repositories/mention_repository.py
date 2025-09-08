"""
Mention repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_, or_
from app.core.repository_base import BaseRepository
from app.models.mention import Mention
from app.models.user import User
from app.models.post import Post


class MentionRepository(BaseRepository):
    """Repository for Mention model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Mention)
    
    async def get_post_mentions(
        self, 
        post_id: str,
        load_users: bool = True
    ) -> List[Mention]:
        """
        Get all mentions for a specific post.
        
        Args:
            post_id: ID of the post
            load_users: Whether to load user relationships
            
        Returns:
            List[Mention]: List of mentions for the post
        """
        load_relationships = ["author", "mentioned_user"] if load_users else None
        
        return await self.find_all(
            filters={"post_id": post_id},
            order_by=desc(Mention.created_at),
            load_relationships=load_relationships
        )
    
    async def get_user_mentions(
        self, 
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        load_relationships: bool = True
    ) -> List[Mention]:
        """
        Get all mentions received by a specific user.
        
        Args:
            user_id: ID of the mentioned user
            limit: Maximum number of mentions
            offset: Number of mentions to skip
            load_relationships: Whether to load related objects
            
        Returns:
            List[Mention]: List of mentions received by the user
        """
        load_rels = ["author", "post"] if load_relationships else None
        
        return await self.find_all(
            filters={"mentioned_user_id": user_id},
            order_by=desc(Mention.created_at),
            limit=limit,
            offset=offset,
            load_relationships=load_rels
        )
    
    async def get_authored_mentions(
        self, 
        author_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> List[Mention]:
        """
        Get all mentions created by a specific user.
        
        Args:
            author_id: ID of the author
            limit: Maximum number of mentions
            offset: Number of mentions to skip
            
        Returns:
            List[Mention]: List of mentions created by the user
        """
        return await self.find_all(
            filters={"author_id": author_id},
            order_by=desc(Mention.created_at),
            limit=limit,
            offset=offset,
            load_relationships=["mentioned_user", "post"]
        )
    
    async def check_mention_exists(
        self, 
        post_id: str, 
        mentioned_user_id: int
    ) -> bool:
        """
        Check if a mention already exists for a user in a post.
        
        Args:
            post_id: ID of the post
            mentioned_user_id: ID of the mentioned user
            
        Returns:
            bool: True if mention exists, False otherwise
        """
        mention = await self.find_one({
            "post_id": post_id,
            "mentioned_user_id": mentioned_user_id
        })
        return mention is not None
    
    async def get_mention_counts(self, user_id: int) -> Dict[str, int]:
        """
        Get mention statistics for a user.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict: Dictionary with mention statistics
        """
        # Count mentions received
        received_count = await self.count({"mentioned_user_id": user_id})
        
        # Count mentions authored
        authored_count = await self.count({"author_id": user_id})
        
        return {
            "mentions_received": received_count,
            "mentions_authored": authored_count
        }
    
    async def get_recent_mentioners(
        self, 
        user_id: int, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get users who recently mentioned the specified user.
        
        Args:
            user_id: ID of the mentioned user
            limit: Maximum number of recent mentioners
            
        Returns:
            List[Dict]: List of recent mentioner information
        """
        query = select(
            User.id,
            User.username,
            User.profile_image_url,
            func.max(Mention.created_at).label('last_mention_at'),
            func.count(Mention.id).label('mention_count')
        ).select_from(
            Mention
        ).join(
            User, Mention.author_id == User.id
        ).where(
            Mention.mentioned_user_id == user_id
        ).group_by(
            User.id, User.username, User.profile_image_url
        ).order_by(
            desc(func.max(Mention.created_at))
        ).limit(limit)
        
        result = await self._execute_query(query, "get recent mentioners")
        rows = result.fetchall()
        
        mentioners = []
        for row in rows:
            mentioners.append({
                "user_id": row.id,
                "username": row.username,
                "profile_image_url": row.profile_image_url,
                "last_mention_at": row.last_mention_at.isoformat(),
                "mention_count": int(row.mention_count)
            })
        
        return mentioners
    
    async def get_mention_analytics(
        self, 
        user_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get mention analytics for a user or globally.
        
        Args:
            user_id: Optional user ID to filter by (for mentions received)
            days: Number of days to look back
            
        Returns:
            Dict: Analytics data
        """
        where_conditions = ["m.created_at >= NOW() - INTERVAL :days DAY"]
        params = {"days": days}
        
        if user_id:
            where_conditions.append("m.mentioned_user_id = :user_id")
            params["user_id"] = user_id
        
        where_clause = " AND ".join(where_conditions)
        
        query = text(f"""
            SELECT 
                COUNT(DISTINCT m.id) as total_mentions,
                COUNT(DISTINCT m.author_id) as unique_mentioners,
                COUNT(DISTINCT m.mentioned_user_id) as unique_mentioned_users,
                COUNT(DISTINCT m.post_id) as posts_with_mentions,
                AVG(daily_counts.daily_count) as avg_mentions_per_day
            FROM mentions m
            LEFT JOIN (
                SELECT 
                    DATE(m2.created_at) as mention_date,
                    COUNT(*) as daily_count
                FROM mentions m2
                WHERE {where_clause}
                GROUP BY DATE(m2.created_at)
            ) daily_counts ON 1=1
            WHERE {where_clause}
        """)
        
        result = await self.execute_raw_query(query, params)
        row = result.fetchone()
        
        if not row:
            return {
                "total_mentions": 0,
                "unique_mentioners": 0,
                "unique_mentioned_users": 0,
                "posts_with_mentions": 0,
                "avg_mentions_per_day": 0.0
            }
        
        return {
            "total_mentions": int(row.total_mentions) if row.total_mentions else 0,
            "unique_mentioners": int(row.unique_mentioners) if row.unique_mentioners else 0,
            "unique_mentioned_users": int(row.unique_mentioned_users) if row.unique_mentioned_users else 0,
            "posts_with_mentions": int(row.posts_with_mentions) if row.posts_with_mentions else 0,
            "avg_mentions_per_day": float(row.avg_mentions_per_day) if row.avg_mentions_per_day else 0.0
        }
    
    async def delete_post_mentions(self, post_id: str) -> int:
        """
        Delete all mentions for a specific post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Number of mentions deleted
        """
        from sqlalchemy import text
        
        # Use direct SQL delete to avoid foreign key constraint issues
        query = text("DELETE FROM mentions WHERE post_id = :post_id")
        result = await self.db.execute(query, {"post_id": post_id})
        count = result.rowcount
        
        await self.db.commit()
        return count
    
    async def bulk_create_mentions(
        self, 
        post_id: str, 
        author_id: int, 
        mentioned_user_ids: List[int]
    ) -> List[Mention]:
        """
        Create multiple mentions for a post.
        
        Args:
            post_id: ID of the post
            author_id: ID of the author
            mentioned_user_ids: List of user IDs to mention
            
        Returns:
            List[Mention]: List of created mentions
        """
        mentions = []
        
        for mentioned_user_id in mentioned_user_ids:
            # Check if mention already exists to avoid duplicates
            if not await self.check_mention_exists(post_id, mentioned_user_id):
                mention = await self.create(
                    post_id=post_id,
                    author_id=author_id,
                    mentioned_user_id=mentioned_user_id
                )
                mentions.append(mention)
        
        return mentions