"""
EmojiReaction repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_
from app.core.repository_base import BaseRepository
from app.models.emoji_reaction import EmojiReaction
from app.models.user import User


class EmojiReactionRepository(BaseRepository):
    """Repository for EmojiReaction model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, EmojiReaction)
    
    async def get_user_reaction(
        self, 
        user_id: int, 
        post_id: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> Optional[EmojiReaction]:
        """
        Get a specific user's reaction to a post or object.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post (acts as parent grouping)
            object_type: Type of object being reacted to
            object_id: ID of specific object (defaults to post_id if purely a post reaction)
            
        Returns:
            Optional[EmojiReaction]: The user's reaction if it exists
        """
        actual_object_id = object_id if object_id is not None else post_id
        return await self.find_one({
            "user_id": user_id,
            "object_type": object_type,
            "object_id": actual_object_id
        })

    async def get_user_reaction_count(
        self, 
        user_id: int, 
        post_id: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> int:
        """
        Get count of reactions for a user on a specific object.
        """
        actual_object_id = object_id if object_id is not None else post_id
        result = await self.db.execute(
            select(func.count(EmojiReaction.id))
            .where(
                and_(
                    EmojiReaction.user_id == user_id,
                    EmojiReaction.object_type == object_type,
                    EmojiReaction.object_id == actual_object_id
                )
            )
        )
        return result.scalar() or 0
    
    async def get_post_reactions(
        self, 
        post_id: str,
        load_users: bool = True,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> List[EmojiReaction]:
        """
        Get all reactions for a specific post or its child objects.
        """
        load_relationships = ["user"] if load_users else None
        
        filters = {"post_id": post_id, "object_type": object_type}
        if object_id is not None:
            filters["object_id"] = object_id
        elif object_type == "post":
            filters["object_id"] = post_id
            
        return await self.find_all(
            filters=filters,
            order_by=desc(EmojiReaction.created_at),
            load_relationships=load_relationships
        )
    
    async def get_reaction_counts(
        self, 
        post_id: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> Dict[str, int]:
        """
        Get reaction counts grouped by emoji for an object or group.
        """
        conditions = [
            EmojiReaction.post_id == post_id,
            EmojiReaction.object_type == object_type
        ]
        if object_id is not None:
            conditions.append(EmojiReaction.object_id == object_id)
        elif object_type == "post":
            conditions.append(EmojiReaction.object_id == post_id)
            
        query = select(
            EmojiReaction.emoji_code, 
            func.count(EmojiReaction.id)
        ).where(
            and_(*conditions)
        ).group_by(EmojiReaction.emoji_code)
        
        result = await self._execute_query(query, "get reaction counts")
        
        counts = {}
        for emoji_code, count in result.fetchall():
            counts[emoji_code] = count
            
        return counts
    
    async def get_total_reaction_count(
        self, 
        post_id: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> int:
        """
        Get total number of reactions for an object.
        """
        filters = {"post_id": post_id, "object_type": object_type}
        if object_id is not None:
            filters["object_id"] = object_id
        elif object_type == "post":
            filters["object_id"] = post_id
        return await self.count(filters)
    
    async def get_user_reactions(
        self, 
        user_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> List[EmojiReaction]:
        """
        Get all reactions by a specific user.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of reactions
            offset: Number of reactions to skip
            
        Returns:
            List[EmojiReaction]: List of user's reactions
        """
        builder = self.query().filter(
            EmojiReaction.user_id == user_id
        ).order_by(desc(EmojiReaction.created_at)).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get user reactions")
        return result.scalars().all()
    
    async def get_popular_emojis(
        self, 
        limit: int = 10,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get most popular emojis in the last N days.
        
        Args:
            limit: Maximum number of emojis to return
            days: Number of days to look back
            
        Returns:
            List[Dict]: List of emoji usage statistics
        """
        query = text("""
            SELECT 
                emoji_code,
                COUNT(*) as usage_count,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT post_id) as unique_posts
            FROM emoji_reactions
            WHERE created_at >= NOW() - INTERVAL :days DAY
            GROUP BY emoji_code
            ORDER BY usage_count DESC
            LIMIT :limit
        """)
        
        result = await self.execute_raw_query(query, {"days": days, "limit": limit})
        rows = result.fetchall()
        
        popular_emojis = []
        for row in rows:
            emoji_display = EmojiReaction.VALID_EMOJIS.get(row.emoji_code, '❓')
            popular_emojis.append({
                "emoji_code": row.emoji_code,
                "emoji_display": emoji_display,
                "usage_count": int(row.usage_count),
                "unique_users": int(row.unique_users),
                "unique_posts": int(row.unique_posts)
            })
        
        return popular_emojis
    
    async def get_reaction_analytics(
        self, 
        post_id: Optional[str] = None,
        user_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get reaction analytics for a post or user.
        
        Args:
            post_id: Optional post ID to filter by
            user_id: Optional user ID to filter by (for reactions received)
            days: Number of days to look back
            
        Returns:
            Dict: Analytics data
        """
        where_conditions = ["er.created_at >= NOW() - INTERVAL :days DAY"]
        params = {"days": days}
        
        if post_id:
            where_conditions.append("er.post_id = :post_id")
            params["post_id"] = post_id
        
        if user_id:
            where_conditions.append("p.author_id = :user_id")
            params["user_id"] = user_id
        
        where_clause = " AND ".join(where_conditions)
        
        query = text(f"""
            SELECT 
                COUNT(DISTINCT er.id) as total_reactions,
                COUNT(DISTINCT er.user_id) as unique_reactors,
                COUNT(DISTINCT er.post_id) as posts_with_reactions,
                COUNT(DISTINCT er.emoji_code) as unique_emojis_used,
                AVG(daily_counts.daily_count) as avg_reactions_per_day
            FROM emoji_reactions er
            LEFT JOIN posts p ON p.id = er.post_id
            LEFT JOIN (
                SELECT 
                    DATE(er2.created_at) as reaction_date,
                    COUNT(*) as daily_count
                FROM emoji_reactions er2
                LEFT JOIN posts p2 ON p2.id = er2.post_id
                WHERE {where_clause}
                GROUP BY DATE(er2.created_at)
            ) daily_counts ON 1=1
            WHERE {where_clause}
        """)
        
        result = await self.execute_raw_query(query, params)
        row = result.fetchone()
        
        if not row:
            return {
                "total_reactions": 0,
                "unique_reactors": 0,
                "posts_with_reactions": 0,
                "unique_emojis_used": 0,
                "avg_reactions_per_day": 0.0
            }
        
        return {
            "total_reactions": int(row.total_reactions) if row.total_reactions else 0,
            "unique_reactors": int(row.unique_reactors) if row.unique_reactors else 0,
            "posts_with_reactions": int(row.posts_with_reactions) if row.posts_with_reactions else 0,
            "unique_emojis_used": int(row.unique_emojis_used) if row.unique_emojis_used else 0,
            "avg_reactions_per_day": float(row.avg_reactions_per_day) if row.avg_reactions_per_day else 0.0
        }
    
    async def get_reactions_by_emoji(
        self, 
        emoji_code: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[EmojiReaction]:
        """
        Get all reactions for a specific emoji.
        
        Args:
            emoji_code: Emoji code to filter by
            limit: Maximum number of reactions
            offset: Number of reactions to skip
            
        Returns:
            List[EmojiReaction]: List of reactions with the specified emoji
        """
        return await self.find_all(
            filters={"emoji_code": emoji_code},
            order_by=desc(EmojiReaction.created_at)
        )
    
    async def delete_user_reaction(
        self, 
        user_id: int, 
        post_id: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> bool:
        """
        Delete a user's reaction from an object.
        """
        reaction = await self.get_user_reaction(user_id, post_id, object_type, object_id)
        
        if reaction:
            await self.delete(reaction)
            return True
        
        return False
    
    async def delete_all_post_reactions(
        self, 
        post_id: str,
        object_type: Optional[str] = None,
        object_id: Optional[str] = None
    ) -> int:
        """
        Delete reactions for a specific post (or specific object if params provided).
        """
        from sqlalchemy import text
        
        query = "DELETE FROM emoji_reactions WHERE post_id = :post_id"
        params = {"post_id": post_id}
        
        if object_type:
            query += " AND object_type = :object_type"
            params["object_type"] = object_type
        if object_id:
            query += " AND object_id = :object_id"
            params["object_id"] = object_id
            
        # We assume count is not perfectly tracking with text queries since we removed SELECT COUNT(*), 
        # but execute returns ResultProxy and rowcount works nicely
        result = await self.db.execute(text(query), params)
        return result.rowcount
    
    async def update_user_reaction(
        self, 
        user_id: int, 
        post_id: str, 
        new_emoji_code: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> Optional[EmojiReaction]:
        """
        Update a user's existing reaction to a new emoji.
        """
        reaction = await self.get_user_reaction(user_id, post_id, object_type, object_id)
        
        if reaction:
            return await self.update(reaction, emoji_code=new_emoji_code)
        
        return None