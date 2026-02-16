"""
User repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, or_, and_
from app.core.repository_base import BaseRepository
from app.models.user import User
from app.models.post import Post


class UserRepository(BaseRepository):
    """Repository for User model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, User)
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        return await self.find_one({"email": email})
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        return await self.find_one({"username": username})
    
    async def search_by_username(
        self, 
        query: str, 
        limit: int = 10,
        exclude_user_ids: Optional[List[int]] = None
    ) -> List[User]:
        """
        Search users by username with optional exclusions.
        
        Args:
            query: Search query string
            limit: Maximum number of results
            exclude_user_ids: List of user IDs to exclude from results
            
        Returns:
            List[User]: List of matching users
        """
        builder = self.query().filter(
            or_(
                User.username.ilike(f"%{query}%"),
                User.display_name.ilike(f"%{query}%")
            )
        ).order_by(User.username).limit(limit)
        
        if exclude_user_ids:
            builder = builder.filter(~User.id.in_(exclude_user_ids))
        
        query_obj = builder.build()
        result = await self._execute_query(query_obj, "search users by username")
        return result.scalars().all()
    
    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Get comprehensive user statistics.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing user statistics
        """
        batch_stats = await self.get_user_stats_batch([user_id])
        return batch_stats.get(user_id, {
            "posts_count": 0,
            "public_posts_count": 0,
            "followers_count": 0,
            "following_count": 0
        })

    async def get_user_stats_batch(self, user_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """
        Get comprehensive user statistics for multiple users at once.
        
        Args:
            user_ids: List of user IDs
            
        Returns:
            Dict mapping user_id to statistics dictionary
        """
        if not user_ids:
            return {}

        from app.models.follow import Follow
        
        # 1. Get total posts count per user
        posts_query = (
            select(Post.author_id, func.count(Post.id))
            .where(Post.author_id.in_(user_ids))
            .group_by(Post.author_id)
        )
        posts_result = await self._execute_query(posts_query, "batch get user posts count")
        posts_counts = {row[0]: row[1] for row in posts_result.fetchall()}
        
        # 2. Get public posts count per user
        public_query = (
            select(Post.author_id, func.count(Post.id))
            .where(and_(Post.author_id.in_(user_ids), Post.is_public == True))
            .group_by(Post.author_id)
        )
        public_result = await self._execute_query(public_query, "batch get user public posts count")
        public_counts = {row[0]: row[1] for row in public_result.fetchall()}
        
        # 3. Get followers count per user
        followers_query = (
            select(Follow.followed_id, func.count(Follow.id))
            .where(and_(Follow.followed_id.in_(user_ids), Follow.status == "active"))
            .group_by(Follow.followed_id)
        )
        followers_result = await self._execute_query(followers_query, "batch get user followers count")
        followers_counts = {row[0]: row[1] for row in followers_result.fetchall()}
        
        # 4. Get following count per user
        following_query = (
            select(Follow.follower_id, func.count(Follow.id))
            .where(and_(Follow.follower_id.in_(user_ids), Follow.status == "active"))
            .group_by(Follow.follower_id)
        )
        following_result = await self._execute_query(following_query, "batch get user following count")
        following_counts = {row[0]: row[1] for row in following_result.fetchall()}
        
        # Compile result dictionary
        result = {}
        for user_id in user_ids:
            result[user_id] = {
                "posts_count": posts_counts.get(user_id, 0),
                "public_posts_count": public_counts.get(user_id, 0),
                "followers_count": followers_counts.get(user_id, 0),
                "following_count": following_counts.get(user_id, 0)
            }
            
        return result
    
    async def check_username_availability(
        self, 
        username: str, 
        exclude_user_id: Optional[int] = None
    ) -> bool:
        """
        Check if username is available.
        
        Args:
            username: Username to check
            exclude_user_id: User ID to exclude from check (for updates)
            
        Returns:
            bool: True if username is available, False otherwise
        """
        builder = self.query().filter(User.username == username)
        
        if exclude_user_id:
            builder = builder.filter(User.id != exclude_user_id)
        
        query = builder.build()
        result = await self._execute_query(query, "check username availability")
        existing_user = result.scalar_one_or_none()
        
        return existing_user is None
    
    async def check_email_availability(
        self, 
        email: str, 
        exclude_user_id: Optional[int] = None
    ) -> bool:
        """
        Check if email is available.
        
        Args:
            email: Email to check
            exclude_user_id: User ID to exclude from check (for updates)
            
        Returns:
            bool: True if email is available, False otherwise
        """
        builder = self.query().filter(User.email == email)
        
        if exclude_user_id:
            builder = builder.filter(User.id != exclude_user_id)
        
        query = builder.build()
        result = await self._execute_query(query, "check email availability")
        existing_user = result.scalar_one_or_none()
        
        return existing_user is None
    
    async def get_recently_active_users(
        self, 
        limit: int = 10,
        days: int = 30
    ) -> List[User]:
        """
        Get users who have been recently active (posted in last N days).
        
        Args:
            limit: Maximum number of users to return
            days: Number of days to look back
            
        Returns:
            List[User]: List of recently active users
        """
        query = text("""
            SELECT DISTINCT u.*
            FROM users u
            INNER JOIN posts p ON p.author_id = u.id
            WHERE p.created_at >= NOW() - INTERVAL :days DAY
            ORDER BY u.username
            LIMIT :limit
        """)
        
        result = await self.execute_raw_query(query, {"days": days, "limit": limit})
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
    
    async def get_user_engagement_metrics(self, user_id: int) -> Dict[str, Any]:
        """
        Get user engagement metrics (posts, reactions received, etc.).
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing engagement metrics
        """
        # This is a complex query that joins multiple tables
        query = text("""
            SELECT 
                u.id,
                u.username,
                COUNT(DISTINCT p.id) as posts_count,
                COUNT(DISTINCT er.id) as reactions_received,
                COUNT(DISTINCT l.id) as hearts_received
            FROM users u
            LEFT JOIN posts p ON p.author_id = u.id
            LEFT JOIN emoji_reactions er ON er.post_id = p.id
            LEFT JOIN likes l ON l.post_id = p.id
            WHERE u.id = :user_id
            GROUP BY u.id, u.username
        """)
        
        result = await self.execute_raw_query(query, {"user_id": user_id})
        row = result.fetchone()
        
        if not row:
            return {
                "posts_count": 0,
                "reactions_received": 0,
                "hearts_received": 0
            }
        
        return {
            "posts_count": int(row.posts_count) if row.posts_count else 0,
            "reactions_received": int(row.reactions_received) if row.reactions_received else 0,
            "hearts_received": int(row.hearts_received) if row.hearts_received else 0
        }
    
    async def get_existing_usernames(self, usernames: List[str]) -> List[str]:
        """
        Get list of usernames that exist in the database.
        
        Args:
            usernames: List of usernames to check
            
        Returns:
            List[str]: List of usernames that exist in the database
        """
        if not usernames:
            return []
        
        # Use case-insensitive comparison for username matching
        from sqlalchemy import func
        lowercase_usernames = [username.lower() for username in usernames]
        query = self.query().filter(func.lower(User.username).in_(lowercase_usernames)).build()
        result = await self._execute_query(query, "get existing usernames")
        users = result.scalars().all()
        
        return [user.username for user in users]
    
    async def get_by_username_or_404(self, username: str) -> User:
        """
        Get user by username or raise NotFoundError.
        
        Args:
            username: Username to find
            
        Returns:
            User: The user object
            
        Raises:
            NotFoundError: If user is not found
        """
        user = await self.get_by_username(username)
        if not user:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("User", username)
        return user