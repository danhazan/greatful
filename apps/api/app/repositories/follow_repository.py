"""
Follow repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_, text
from app.core.repository_base import BaseRepository
from app.models.follow import Follow
from app.models.user import User


class FollowRepository(BaseRepository):
    """Repository for Follow model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Follow)
    
    async def get_follow_relationship(
        self, 
        follower_id: int, 
        followed_id: int
    ) -> Optional[Follow]:
        """
        Get follow relationship between two users.
        
        Args:
            follower_id: ID of the follower user
            followed_id: ID of the followed user
            
        Returns:
            Optional[Follow]: The follow relationship if it exists
        """
        return await self.find_one({
            "follower_id": follower_id,
            "followed_id": followed_id
        })
    
    async def is_following(
        self, 
        follower_id: int, 
        followed_id: int,
        status: str = "active"
    ) -> bool:
        """
        Check if one user is following another.
        
        Args:
            follower_id: ID of the follower user
            followed_id: ID of the followed user
            status: Status to check for (default: "active")
            
        Returns:
            bool: True if following relationship exists with given status
        """
        follow = await self.find_one({
            "follower_id": follower_id,
            "followed_id": followed_id,
            "status": status
        })
        return follow is not None
    
    async def get_followers(
        self, 
        user_id: int, 
        status: str = "active",
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[User], int]:
        """
        Get users who are following the given user.
        
        Args:
            user_id: ID of the user whose followers to get
            status: Status of follow relationships to include
            limit: Maximum number of followers to return
            offset: Number of followers to skip
            
        Returns:
            tuple: (followers_list, total_count)
        """
        # Build query to get followers with user details
        query = (
            select(User)
            .join(Follow, Follow.follower_id == User.id)
            .where(
                and_(
                    Follow.followed_id == user_id,
                    Follow.status == status
                )
            )
            .order_by(Follow.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await self._execute_query(query, "get followers")
        followers = result.scalars().all()
        
        # Get total count
        count_query = (
            select(func.count(Follow.id))
            .where(
                and_(
                    Follow.followed_id == user_id,
                    Follow.status == status
                )
            )
        )
        
        count_result = await self._execute_query(count_query, "count followers")
        total_count = count_result.scalar() or 0
        
        return followers, total_count
    
    async def get_following(
        self, 
        user_id: int, 
        status: str = "active",
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[User], int]:
        """
        Get users that the given user is following.
        
        Args:
            user_id: ID of the user whose following list to get
            status: Status of follow relationships to include
            limit: Maximum number of following to return
            offset: Number of following to skip
            
        Returns:
            tuple: (following_list, total_count)
        """
        # Build query to get following with user details
        query = (
            select(User)
            .join(Follow, Follow.followed_id == User.id)
            .where(
                and_(
                    Follow.follower_id == user_id,
                    Follow.status == status
                )
            )
            .order_by(Follow.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await self._execute_query(query, "get following")
        following = result.scalars().all()
        
        # Get total count
        count_query = (
            select(func.count(Follow.id))
            .where(
                and_(
                    Follow.follower_id == user_id,
                    Follow.status == status
                )
            )
        )
        
        count_result = await self._execute_query(count_query, "count following")
        total_count = count_result.scalar() or 0
        
        return following, total_count
    
    async def get_followers_count(self, user_id: int, status: str = "active") -> int:
        """
        Get count of followers for a user.
        
        Args:
            user_id: ID of the user
            status: Status of follow relationships to count
            
        Returns:
            int: Number of followers
        """
        return await self.count({
            "followed_id": user_id,
            "status": status
        })
    
    async def get_following_count(self, user_id: int, status: str = "active") -> int:
        """
        Get count of users that the given user is following.
        
        Args:
            user_id: ID of the user
            status: Status of follow relationships to count
            
        Returns:
            int: Number of users being followed
        """
        return await self.count({
            "follower_id": user_id,
            "status": status
        })
    
    async def get_mutual_follows(
        self, 
        user1_id: int, 
        user2_id: int,
        status: str = "active"
    ) -> bool:
        """
        Check if two users follow each other (mutual follow).
        
        Args:
            user1_id: ID of the first user
            user2_id: ID of the second user
            status: Status to check for
            
        Returns:
            bool: True if both users follow each other
        """
        # Check if user1 follows user2 AND user2 follows user1
        query = (
            select(func.count(Follow.id))
            .where(
                or_(
                    and_(
                        Follow.follower_id == user1_id,
                        Follow.followed_id == user2_id,
                        Follow.status == status
                    ),
                    and_(
                        Follow.follower_id == user2_id,
                        Follow.followed_id == user1_id,
                        Follow.status == status
                    )
                )
            )
        )
        
        result = await self._execute_query(query, "check mutual follows")
        count = result.scalar() or 0
        
        # Both relationships must exist for mutual follow
        return count == 2
    
    async def get_follow_suggestions(
        self, 
        user_id: int, 
        limit: int = 10
    ) -> List[User]:
        """
        Get follow suggestions for a user based on mutual connections.
        
        Args:
            user_id: ID of the user to get suggestions for
            limit: Maximum number of suggestions
            
        Returns:
            List[User]: List of suggested users to follow
        """
        # Complex query to find users followed by people the user follows
        # but not already followed by the user
        query = text("""
            SELECT DISTINCT u.*
            FROM users u
            INNER JOIN follows f1 ON f1.followed_id = u.id
            INNER JOIN follows f2 ON f2.follower_id = f1.follower_id
            WHERE f2.followed_id = :user_id
              AND f1.status = 'active'
              AND f2.status = 'active'
              AND u.id != :user_id
              AND u.id NOT IN (
                  SELECT followed_id 
                  FROM follows 
                  WHERE follower_id = :user_id 
                    AND status = 'active'
              )
            ORDER BY u.username
            LIMIT :limit
        """)
        
        result = await self.execute_raw_query(query, {
            "user_id": user_id,
            "limit": limit
        })
        rows = result.fetchall()
        
        # Convert rows to User objects
        users = []
        for row in rows:
            user = User(
                id=row.id,
                email=row.email,
                username=row.username,
                hashed_password=row.hashed_password,
                bio=row.bio,
                profile_image_url=row.profile_image_url,
                created_at=row.created_at
            )
            users.append(user)
        
        return users
    
    async def get_follow_stats(self, user_id: int) -> Dict[str, int]:
        """
        Get comprehensive follow statistics for a user.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing follow statistics
        """
        followers_count = await self.get_followers_count(user_id)
        following_count = await self.get_following_count(user_id)
        
        # Get pending follow requests (incoming)
        pending_requests = await self.count({
            "followed_id": user_id,
            "status": "pending"
        })
        
        # Get pending follow requests (outgoing)
        pending_sent = await self.count({
            "follower_id": user_id,
            "status": "pending"
        })
        
        return {
            "followers_count": followers_count,
            "following_count": following_count,
            "pending_requests": pending_requests,
            "pending_sent": pending_sent
        }
    
    async def bulk_check_following_status(
        self, 
        follower_id: int, 
        user_ids: List[int]
    ) -> Dict[int, Optional[str]]:
        """
        Check following status for multiple users at once.
        
        Args:
            follower_id: ID of the follower user
            user_ids: List of user IDs to check
            
        Returns:
            Dict mapping user_id to follow status (None if not following)
        """
        if not user_ids:
            return {}
        
        query = (
            select(Follow.followed_id, Follow.status)
            .where(
                and_(
                    Follow.follower_id == follower_id,
                    Follow.followed_id.in_(user_ids)
                )
            )
        )
        
        result = await self._execute_query(query, "bulk check following status")
        rows = result.fetchall()
        
        # Create mapping of user_id to status
        status_map = {user_id: None for user_id in user_ids}
        for row in rows:
            status_map[row.followed_id] = row.status
        
        return status_map