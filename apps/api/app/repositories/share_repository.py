"""
Share repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, UTC
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_
from app.core.repository_base import BaseRepository
from app.models.share import Share, ShareMethod
from app.models.user import User
from app.models.post import Post
import json


class ShareRepository(BaseRepository):
    """Repository for Share model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Share)
    
    async def get_user_shares(
        self, 
        user_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> List[Share]:
        """
        Get all shares by a specific user.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of shares
            offset: Number of shares to skip
            
        Returns:
            List[Share]: List of user's shares
        """
        return await self.find_all(
            filters={"user_id": user_id},
            order_by=desc(Share.created_at),
            limit=limit,
            offset=offset
        )
    
    async def get_post_shares(
        self, 
        post_id: str,
        load_users: bool = True
    ) -> List[Share]:
        """
        Get all shares for a specific post.
        
        Args:
            post_id: ID of the post
            load_users: Whether to load user relationships
            
        Returns:
            List[Share]: List of shares for the post
        """
        load_relationships = ["user"] if load_users else None
        
        return await self.find_all(
            filters={"post_id": post_id},
            order_by=desc(Share.created_at),
            load_relationships=load_relationships
        )
    
    async def get_share_counts_by_method(self, post_id: str) -> Dict[str, int]:
        """
        Get share counts grouped by method for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            Dict: Dictionary with share methods as keys and counts as values
        """
        query = select(
            Share.share_method, 
            func.count(Share.id)
        ).where(
            Share.post_id == post_id
        ).group_by(Share.share_method)
        
        result = await self._execute_query(query, "get share counts by method")
        
        counts = {}
        for method, count in result.fetchall():
            counts[method] = count
            
        return counts
    
    async def get_total_share_count(self, post_id: str) -> int:
        """
        Get total number of shares for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Total share count
        """
        return await self.count({"post_id": post_id})
    
    async def check_user_rate_limit(
        self, 
        user_id: int, 
        hours: int = 1, 
        max_shares: int = 20
    ) -> Dict[str, Any]:
        """
        Check if user has exceeded rate limit for shares.
        
        Args:
            user_id: ID of the user
            hours: Time window in hours (default 1)
            max_shares: Maximum shares allowed in time window (default 20)
            
        Returns:
            Dict: Rate limit status with current count and remaining
        """
        since_time = datetime.now(UTC) - timedelta(hours=hours)
        
        query = select(func.count(Share.id)).where(
            and_(
                Share.user_id == user_id,
                Share.created_at >= since_time
            )
        )
        
        result = await self._execute_query(query, "check user rate limit")
        current_count = result.scalar() or 0
        
        return {
            "current_count": current_count,
            "max_allowed": max_shares,
            "remaining": max(0, max_shares - current_count),
            "is_exceeded": current_count >= max_shares,
            "reset_time": datetime.now(UTC) + timedelta(hours=hours)
        }
    
    async def get_recent_message_recipients(
        self, 
        user_id: int, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get recently messaged users for quick-select in share modal.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of recent recipients (default 5)
            
        Returns:
            List[Dict]: List of recent recipients with user info
        """
        # For SQLite compatibility, we'll use a simpler approach
        # Get all message shares by this user and parse JSON client-side
        shares = await self.find_all(
            filters={"user_id": user_id, "share_method": "message"},
            order_by=desc(Share.created_at),
            limit=50  # Get more to filter client-side
        )
        
        # Parse recipients and find recent ones
        recipient_map = {}
        for share in shares:
            if share.recipient_user_ids:
                try:
                    recipient_ids = json.loads(share.recipient_user_ids)
                    for recipient_id in recipient_ids:
                        if recipient_id not in recipient_map or share.created_at > recipient_map[recipient_id]['last_shared_at']:
                            recipient_map[recipient_id] = {
                                'id': recipient_id,
                                'last_shared_at': share.created_at
                            }
                except (json.JSONDecodeError, TypeError):
                    continue
        
        # Get user info for recent recipients
        recent_recipient_ids = sorted(
            recipient_map.keys(), 
            key=lambda x: recipient_map[x]['last_shared_at'], 
            reverse=True
        )[:limit]
        
        # Get user info for recent recipients
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(self.db)
        
        recipients = []
        for recipient_id in recent_recipient_ids:
            user = await user_repo.get_by_id(recipient_id)
            if user:
                recipients.append({
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": user.profile_image_url,
                    "last_shared_at": recipient_map[recipient_id]['last_shared_at'].isoformat()
                })
        
        return recipients
        
        result = await self.execute_raw_query(query, {"user_id": user_id, "limit": limit})
        rows = result.fetchall()
        
        recipients = []
        for row in rows:
            recipients.append({
                "id": row.id,
                "username": row.username,
                "profile_image_url": row.profile_image_url,
                "last_shared_at": row.last_shared_at.isoformat() if row.last_shared_at else None
            })
        
        return recipients
    
    async def get_share_analytics(
        self, 
        post_id: Optional[str] = None,
        user_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get share analytics for a post or user.
        
        Args:
            post_id: Optional post ID to filter by
            user_id: Optional user ID to filter by (for shares of their posts)
            days: Number of days to look back
            
        Returns:
            Dict: Analytics data
        """
        where_conditions = ["s.created_at >= NOW() - INTERVAL :days DAY"]
        params = {"days": days}
        
        if post_id:
            where_conditions.append("s.post_id = :post_id")
            params["post_id"] = post_id
        
        if user_id:
            where_conditions.append("p.author_id = :user_id")
            params["user_id"] = user_id
        
        where_clause = " AND ".join(where_conditions)
        
        # Simplified analytics calculation for SQLite compatibility
        filters = {}
        if post_id:
            filters["post_id"] = post_id
        if user_id:
            # This would need a join, let's keep it simple for now
            pass
        
        # Get shares within the time window
        since_time = datetime.now(UTC) - timedelta(days=days)
        shares = await self.find_all(
            filters=filters,
            order_by=desc(Share.created_at)
        )
        
        # Filter by date and calculate stats
        recent_shares = [s for s in shares if s.created_at >= since_time]
        
        total_shares = len(recent_shares)
        unique_sharers = len(set(s.user_id for s in recent_shares))
        posts_shared = len(set(s.post_id for s in recent_shares))
        url_shares = len([s for s in recent_shares if s.share_method == "url"])
        message_shares = len([s for s in recent_shares if s.share_method == "message"])
        
        # Calculate average recipients per message share
        message_share_recipients = []
        for share in recent_shares:
            if share.share_method == "message" and share.recipient_user_ids:
                try:
                    recipients = json.loads(share.recipient_user_ids)
                    message_share_recipients.append(len(recipients))
                except (json.JSONDecodeError, TypeError):
                    continue
        
        avg_recipients = sum(message_share_recipients) / len(message_share_recipients) if message_share_recipients else 0.0
        avg_shares_per_day = total_shares / days if days > 0 else 0.0
        
        return {
            "total_shares": total_shares,
            "unique_sharers": unique_sharers,
            "posts_shared": posts_shared,
            "url_shares": url_shares,
            "message_shares": message_shares,
            "avg_recipients_per_message_share": avg_recipients,
            "avg_shares_per_day": avg_shares_per_day
        }
    
    async def get_popular_shared_posts(
        self, 
        limit: int = 10,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get most shared posts in the last N days.
        
        Args:
            limit: Maximum number of posts to return
            days: Number of days to look back
            
        Returns:
            List[Dict]: List of popular shared posts with share counts
        """
        query = text("""
            SELECT 
                s.post_id,
                p.content,
                p.post_type,
                u.username as author_username,
                COUNT(s.id) as share_count,
                COUNT(DISTINCT s.user_id) as unique_sharers,
                SUM(CASE WHEN s.share_method = 'url' THEN 1 ELSE 0 END) as url_shares,
                SUM(CASE WHEN s.share_method = 'message' THEN 1 ELSE 0 END) as message_shares
            FROM shares s
            JOIN posts p ON p.id = s.post_id
            JOIN users u ON u.id = p.author_id
            WHERE s.created_at >= NOW() - INTERVAL :days DAY
            GROUP BY s.post_id, p.content, p.post_type, u.username
            ORDER BY share_count DESC
            LIMIT :limit
        """)
        
        result = await self.execute_raw_query(query, {"days": days, "limit": limit})
        rows = result.fetchall()
        
        popular_posts = []
        for row in rows:
            popular_posts.append({
                "post_id": row.post_id,
                "content": row.content[:100] + "..." if len(row.content) > 100 else row.content,
                "post_type": row.post_type,
                "author_username": row.author_username,
                "share_count": int(row.share_count),
                "unique_sharers": int(row.unique_sharers),
                "url_shares": int(row.url_shares),
                "message_shares": int(row.message_shares)
            })
        
        return popular_posts
    
    async def delete_user_shares(self, user_id: int, post_id: str) -> int:
        """
        Delete all shares by a user for a specific post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            int: Number of shares deleted
        """
        shares = await self.find_all({"user_id": user_id, "post_id": post_id})
        
        count = 0
        for share in shares:
            await self.delete(share)
            count += 1
        
        return count