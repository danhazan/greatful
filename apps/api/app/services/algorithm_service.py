"""
Algorithm service for calculating post engagement scores and feed ranking.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple, Set
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, and_, or_

from app.core.service_base import BaseService
from app.models.post import Post, PostType
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.follow import Follow
from app.models.user import User
from app.config.algorithm_config import get_algorithm_config

logger = logging.getLogger(__name__)


class AlgorithmService(BaseService):
    """
    Service for calculating post engagement scores and generating personalized feeds.
    
    Uses configurable scoring weights and factors from algorithm_config.py.
    Configuration can be environment-specific (dev/staging/prod).
    
    Includes read status tracking to deprioritize already-read posts in feed ranking.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.config = get_algorithm_config()
        # In-memory read status cache per user session
        # Format: {user_id: {post_id: read_timestamp}}
        self._read_status_cache: Dict[int, Dict[str, datetime]] = {}
    
    def reload_config(self) -> None:
        """Reload algorithm configuration (useful for testing or config updates)."""
        from app.config.algorithm_config import reload_algorithm_config
        reload_algorithm_config()
        self.config = get_algorithm_config()
        logger.info("Algorithm configuration reloaded")

    # Read Status Tracking Methods
    
    def mark_posts_as_read(self, user_id: int, post_ids: List[str]) -> None:
        """
        Mark posts as read for a specific user in the current session.
        
        Args:
            user_id: ID of the user who read the posts
            post_ids: List of post IDs that were read
        """
        if user_id not in self._read_status_cache:
            self._read_status_cache[user_id] = {}
        
        current_time = datetime.now(timezone.utc)
        for post_id in post_ids:
            self._read_status_cache[user_id][post_id] = current_time
        
        logger.debug(f"Marked {len(post_ids)} posts as read for user {user_id}")

    def get_read_posts(self, user_id: int) -> Set[str]:
        """
        Get set of post IDs that have been read by the user in current session.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Set[str]: Set of post IDs that have been read
        """
        if user_id not in self._read_status_cache:
            return set()
        
        return set(self._read_status_cache[user_id].keys())

    def is_post_read(self, user_id: int, post_id: str) -> bool:
        """
        Check if a specific post has been read by the user.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post to check
            
        Returns:
            bool: True if post has been read, False otherwise
        """
        return post_id in self.get_read_posts(user_id)

    def get_read_status_for_posts(self, user_id: int, post_ids: List[str]) -> Dict[str, bool]:
        """
        Get read status for multiple posts.
        
        Args:
            user_id: ID of the user
            post_ids: List of post IDs to check
            
        Returns:
            Dict[str, bool]: Mapping of post_id to read status
        """
        read_posts = self.get_read_posts(user_id)
        return {post_id: post_id in read_posts for post_id in post_ids}

    def clear_read_status(self, user_id: int) -> None:
        """
        Clear all read status for a user (useful for testing or session reset).
        
        Args:
            user_id: ID of the user whose read status to clear
        """
        if user_id in self._read_status_cache:
            del self._read_status_cache[user_id]
        logger.debug(f"Cleared read status for user {user_id}")

    def get_read_status_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Get summary of read status for debugging.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict[str, Any]: Summary including read count and recent reads
        """
        if user_id not in self._read_status_cache:
            return {"read_count": 0, "recent_reads": []}
        
        user_reads = self._read_status_cache[user_id]
        recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_reads = [
            {"post_id": post_id, "read_at": read_time.isoformat()}
            for post_id, read_time in user_reads.items()
            if read_time >= recent_cutoff
        ]
        
        return {
            "read_count": len(user_reads),
            "recent_reads": recent_reads
        }

    async def calculate_post_score(
        self, 
        post: Post, 
        user_id: Optional[int] = None,
        hearts_count: Optional[int] = None,
        reactions_count: Optional[int] = None,
        shares_count: Optional[int] = None,
        consider_read_status: bool = True,
        user_last_feed_view: Optional[datetime] = None
    ) -> float:
        """
        Calculate engagement score for a post with enhanced time factoring.
        
        Args:
            post: Post object to score
            user_id: ID of the user viewing the feed (for relationship multiplier and read status)
            hearts_count: Pre-calculated hearts count (optional, will query if not provided)
            reactions_count: Pre-calculated reactions count (optional, will query if not provided)
            shares_count: Pre-calculated shares count (optional, will query if not provided)
            consider_read_status: Whether to apply read status penalty (default: True)
            user_last_feed_view: User's last feed view timestamp for unread detection
            
        Returns:
            float: Calculated engagement score with time factoring and read status consideration
        """
        # Get engagement counts if not provided
        if hearts_count is None:
            hearts_result = await self.db.execute(
                select(func.count(Like.id)).where(Like.post_id == post.id)
            )
            hearts_count = hearts_result.scalar() or 0

        if reactions_count is None:
            reactions_result = await self.db.execute(
                select(func.count(EmojiReaction.id)).where(EmojiReaction.post_id == post.id)
            )
            reactions_count = reactions_result.scalar() or 0

        if shares_count is None:
            shares_result = await self.db.execute(
                select(func.count(Share.id)).where(Share.post_id == post.id)
            )
            shares_count = shares_result.scalar() or 0

        # Base engagement score using configurable weights
        scoring_weights = self.config.scoring_weights
        base_score = (
            (hearts_count * scoring_weights.hearts) + 
            (reactions_count * scoring_weights.reactions) + 
            (shares_count * scoring_weights.shares)
        )
        
        # Content type bonuses using configurable values
        content_bonus = 0.0
        if post.post_type == PostType.photo:
            content_bonus += scoring_weights.photo_bonus
        elif post.post_type == PostType.daily:
            content_bonus += scoring_weights.daily_gratitude_bonus
        
        # Enhanced time factoring for recent posts
        time_multiplier = self._calculate_time_factor(post)
        
        # Relationship multiplier using configurable follow bonuses
        relationship_multiplier = 1.0
        if user_id and post.author_id != user_id:
            # Check if user follows the post author
            follow_result = await self.db.execute(
                select(Follow.id).where(
                    and_(
                        Follow.follower_id == user_id,
                        Follow.followed_id == post.author_id,
                        Follow.status == "active"
                    )
                )
            )
            if follow_result.scalar_one_or_none():
                relationship_multiplier = self.config.follow_bonuses.base_multiplier

        # Apply unread boost or read status penalty
        unread_multiplier = 1.0
        if consider_read_status and user_id:
            # Check if post is unread based on last_feed_view timestamp
            is_unread_by_timestamp = False
            if user_last_feed_view and post.created_at:
                # Handle timezone-aware comparison
                post_created_at = post.created_at
                if post_created_at.tzinfo is None:
                    post_created_at = post_created_at.replace(tzinfo=timezone.utc)
                
                user_feed_view = user_last_feed_view
                if user_feed_view.tzinfo is None:
                    user_feed_view = user_feed_view.replace(tzinfo=timezone.utc)
                
                is_unread_by_timestamp = post_created_at > user_feed_view
            
            # Check session-based read status
            is_read_in_session = self.is_post_read(user_id, post.id)
            
            # Apply unread boost if post is unread by timestamp and not read in session
            if is_unread_by_timestamp and not is_read_in_session:
                unread_multiplier = self.config.scoring_weights.unread_boost
                logger.debug(f"Applied unread boost to post {post.id}: {unread_multiplier:.2f}")
            elif is_read_in_session:
                # Apply read penalty for session-read posts
                unread_multiplier = 1.0 / self.config.scoring_weights.unread_boost
                logger.debug(f"Applied read status penalty to post {post.id}: {unread_multiplier:.2f}")

        # Calculate final score with enhanced time factoring
        final_score = (base_score + content_bonus) * relationship_multiplier * unread_multiplier * time_multiplier
        
        logger.debug(
            f"Post {post.id} score calculation: "
            f"base={base_score:.2f} (hearts={hearts_count}, reactions={reactions_count}, shares={shares_count}), "
            f"content_bonus={content_bonus:.2f}, relationship_multiplier={relationship_multiplier:.2f}, "
            f"unread_multiplier={unread_multiplier:.2f}, time_multiplier={time_multiplier:.2f}, "
            f"final={final_score:.2f}"
        )
        
        return final_score

    def _calculate_time_factor(self, post: Post) -> float:
        """
        Calculate time-based multiplier for post scoring with enhanced time factoring.
        
        Implements:
        - Configurable decay hours (default: 72 hours for 3-day decay)
        - Graduated time bonuses (0-1hr +4.0, 1-6hr +2.0, 6-24hr +1.0)
        - Time decay factor to prevent feed staleness with old high-engagement posts
        
        Args:
            post: Post object to calculate time factor for
            
        Returns:
            float: Time-based multiplier (1.0 = no change, >1.0 = boost, <1.0 = decay)
        """
        if not post.created_at:
            return 1.0
        
        # Handle timezone-aware comparison
        post_created_at = post.created_at
        if post_created_at.tzinfo is None:
            post_created_at = post_created_at.replace(tzinfo=timezone.utc)
        
        current_time = datetime.now(timezone.utc)
        hours_old = (current_time - post_created_at).total_seconds() / 3600
        
        time_factors = self.config.time_factors
        
        # Apply graduated time bonuses for recent posts
        recency_bonus = 0.0
        if hours_old <= 1:
            recency_bonus = time_factors.recent_boost_1hr
        elif hours_old <= 6:
            recency_bonus = time_factors.recent_boost_6hr
        elif hours_old <= 24:
            recency_bonus = time_factors.recent_boost_24hr
        
        # Apply time decay factor for older posts
        decay_multiplier = 1.0
        if hours_old > 24:
            # Exponential decay after 24 hours, reaching 0.1 at decay_hours
            decay_hours = time_factors.decay_hours
            if hours_old >= decay_hours:
                # Minimum multiplier to prevent complete elimination
                decay_multiplier = 0.1
            else:
                # Exponential decay: starts at 1.0 at 24hrs, reaches 0.1 at decay_hours
                # Formula: 0.1^((hours_old - 24) / (decay_hours - 24))
                decay_progress = (hours_old - 24) / (decay_hours - 24)
                decay_multiplier = max(0.1, 0.1 ** decay_progress)
        
        # Combine recency bonus and decay multiplier
        # Recency bonus is additive (1.0 + bonus), decay is multiplicative
        time_multiplier = (1.0 + recency_bonus) * decay_multiplier
        
        logger.debug(
            f"Time factor for post {post.id}: "
            f"hours_old={hours_old:.1f}, recency_bonus={recency_bonus:.2f}, "
            f"decay_multiplier={decay_multiplier:.3f}, final_multiplier={time_multiplier:.3f}"
        )
        
        return time_multiplier

    async def get_personalized_feed(
        self, 
        user_id: int, 
        limit: int = 20, 
        offset: int = 0,
        algorithm_enabled: bool = True,
        consider_read_status: bool = True,
        refresh_mode: bool = False
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get personalized feed with algorithm-based ranking.
        
        Args:
            user_id: ID of the user requesting the feed
            limit: Maximum number of posts to return
            offset: Number of posts to skip for pagination
            algorithm_enabled: Whether to use algorithm scoring (80/20 split) or just recency
            consider_read_status: Whether to deprioritize already-read posts
            refresh_mode: Whether to prioritize unread posts for refresh (default: False)
            
        Returns:
            Tuple[List[Dict[str, Any]], int]: (posts with scores, total_count)
        """
        # Get user's last feed view timestamp for unread detection
        user_last_feed_view = None
        if consider_read_status:
            user = await self.get_by_id(User, user_id)
            if user:
                user_last_feed_view = user.last_feed_view

        if not algorithm_enabled:
            # Fallback to simple recency-based feed
            return await self._get_recent_feed(user_id, limit, offset, consider_read_status, user_last_feed_view)

        # In refresh mode, prioritize unread posts
        if refresh_mode:
            # Get unread posts first, then fill with algorithm-scored posts
            unread_posts = await self._get_unread_posts(
                user_id, limit, offset, user_last_feed_view, consider_read_status
            )
            
            # If we have enough unread posts, return them
            if len(unread_posts) >= limit:
                combined_posts = unread_posts[:limit]
            else:
                # Fill remaining slots with algorithm-scored posts
                remaining_limit = limit - len(unread_posts)
                unread_post_ids = {post['id'] for post in unread_posts}
                
                algorithm_posts = await self._get_algorithm_scored_posts(
                    user_id, remaining_limit, 0, consider_read_status, user_last_feed_view, unread_post_ids
                )
                
                combined_posts = unread_posts + algorithm_posts
        else:
            # Calculate 80/20 split for normal mode
            algorithm_limit = int(limit * 0.8)
            recent_limit = limit - algorithm_limit

            # Get algorithm-scored posts (80%)
            algorithm_posts = await self._get_algorithm_scored_posts(
                user_id, algorithm_limit, offset, consider_read_status, user_last_feed_view
            )

            # Get recent posts (20%) - exclude posts already in algorithm results
            algorithm_post_ids = {post['id'] for post in algorithm_posts}
            recent_posts = await self._get_recent_posts_excluding(
                user_id, recent_limit, 0, algorithm_post_ids, consider_read_status, user_last_feed_view
            )
            
            combined_posts = algorithm_posts + recent_posts


        
        # Get total count for pagination
        total_count_result = await self.db.execute(
            select(func.count(Post.id)).where(Post.is_public == True)
        )
        total_count = total_count_result.scalar() or 0

        logger.debug(
            f"Generated personalized feed for user {user_id}: "
            f"{len(combined_posts)} total posts, "
            f"total available: {total_count}"
        )

        return combined_posts[:limit], total_count

    async def _get_algorithm_scored_posts(
        self, 
        user_id: int, 
        limit: int, 
        offset: int,
        consider_read_status: bool = True,
        user_last_feed_view: Optional[datetime] = None,
        exclude_ids: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        """Get posts ranked by algorithm score."""
        # Get all public posts first, excluding specified IDs
        conditions = [Post.is_public == True]
        if exclude_ids:
            conditions.append(~Post.id.in_(exclude_ids))
        
        query = select(Post).where(
            and_(*conditions)
        ).options(
            selectinload(Post.author)
        )

        result = await self.db.execute(query)
        posts = result.scalars().all()

        # Calculate scores for each post
        scored_posts = []
        for post in posts:
            # Get engagement counts separately to avoid JOIN multiplication issues
            hearts_result = await self.db.execute(
                select(func.count(Like.id)).where(Like.post_id == post.id)
            )
            hearts_count = hearts_result.scalar() or 0

            reactions_result = await self.db.execute(
                select(func.count(EmojiReaction.id)).where(EmojiReaction.post_id == post.id)
            )
            reactions_count = reactions_result.scalar() or 0

            shares_result = await self.db.execute(
                select(func.count(Share.id)).where(Share.post_id == post.id)
            )
            shares_count = shares_result.scalar() or 0

            score = await self.calculate_post_score(
                post, user_id, hearts_count, reactions_count, shares_count, consider_read_status, user_last_feed_view
            )

            scored_posts.append({
                'id': post.id,
                'author_id': post.author_id,
                'content': post.content,
                'post_style': post.post_style,
                'post_type': post.post_type.value,
                'image_url': post.image_url,
                'location': post.location,
                'location_data': post.location_data,
                'is_public': post.is_public,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'display_name': post.author.display_name,
                    'name': post.author.display_name or post.author.username,
                    'email': post.author.email,
                    'profile_image_url': post.author.profile_image_url
                } if post.author else None,
                'hearts_count': hearts_count,
                'reactions_count': reactions_count,
                'shares_count': shares_count,
                'algorithm_score': score,
                'is_read': self.is_post_read(user_id, post.id) if consider_read_status else False
            })

        # Apply diversity limits and own post factors
        scored_posts = self._apply_diversity_and_own_post_factors(scored_posts, user_id)
        
        # Sort by score (descending) and apply pagination
        scored_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
        return scored_posts[offset:offset + limit]

    async def _get_recent_posts_excluding(
        self, 
        user_id: int, 
        limit: int, 
        offset: int, 
        exclude_ids: set,
        consider_read_status: bool = True,
        user_last_feed_view: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get recent posts excluding specified IDs."""
        query = select(Post).where(
            and_(
                Post.is_public == True,
                ~Post.id.in_(exclude_ids) if exclude_ids else True
            )
        ).order_by(Post.created_at.desc()).options(
            selectinload(Post.author)
        ).limit(limit).offset(offset)

        result = await self.db.execute(query)
        posts = result.scalars().all()

        # Convert to dict format with engagement counts
        recent_posts = []
        for post in posts:
            # Get engagement counts
            hearts_result = await self.db.execute(
                select(func.count(Like.id)).where(Like.post_id == post.id)
            )
            hearts_count = hearts_result.scalar() or 0

            reactions_result = await self.db.execute(
                select(func.count(EmojiReaction.id)).where(EmojiReaction.post_id == post.id)
            )
            reactions_count = reactions_result.scalar() or 0

            shares_result = await self.db.execute(
                select(func.count(Share.id)).where(Share.post_id == post.id)
            )
            shares_count = shares_result.scalar() or 0

            recent_posts.append({
                'id': post.id,
                'author_id': post.author_id,
                'content': post.content,
                'post_style': post.post_style,
                'post_type': post.post_type.value,
                'image_url': post.image_url,
                'location': post.location,
                'location_data': post.location_data,
                'is_public': post.is_public,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'display_name': post.author.display_name,
                    'name': post.author.display_name or post.author.username,
                    'email': post.author.email,
                    'profile_image_url': post.author.profile_image_url
                } if post.author else None,
                'hearts_count': hearts_count,
                'reactions_count': reactions_count,
                'shares_count': shares_count,
                'algorithm_score': 0.0,  # Recent posts don't get algorithm scoring
                'is_read': self.is_post_read(user_id, post.id) if consider_read_status else False
            })

        return recent_posts

    async def _get_recent_feed(
        self, 
        user_id: int, 
        limit: int, 
        offset: int,
        consider_read_status: bool = True,
        user_last_feed_view: Optional[datetime] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get simple recency-based feed (fallback when algorithm is disabled)."""
        recent_posts = await self._get_recent_posts_excluding(user_id, limit, offset, set(), consider_read_status, user_last_feed_view)
        
        # Get total count
        total_count_result = await self.db.execute(
            select(func.count(Post.id)).where(Post.is_public == True)
        )
        total_count = total_count_result.scalar() or 0

        return recent_posts, total_count

    async def _get_unread_posts(
        self, 
        user_id: int, 
        limit: int, 
        offset: int,
        user_last_feed_view: Optional[datetime],
        consider_read_status: bool = True
    ) -> List[Dict[str, Any]]:
        """Get posts that are unread based on user's last feed view timestamp."""
        if not user_last_feed_view:
            # If no last feed view, all posts are considered "unread"
            return await self._get_recent_posts_excluding(user_id, limit, offset, set(), consider_read_status, user_last_feed_view)
        
        # Get posts created after user's last feed view
        query = select(Post).where(
            and_(
                Post.is_public == True,
                Post.created_at > user_last_feed_view
            )
        ).order_by(Post.created_at.desc()).options(
            selectinload(Post.author)
        ).limit(limit).offset(offset)

        result = await self.db.execute(query)
        posts = result.scalars().all()

        # Convert to dict format with engagement counts and unread boost
        unread_posts = []
        for post in posts:
            # Get engagement counts
            hearts_result = await self.db.execute(
                select(func.count(Like.id)).where(Like.post_id == post.id)
            )
            hearts_count = hearts_result.scalar() or 0

            reactions_result = await self.db.execute(
                select(func.count(EmojiReaction.id)).where(EmojiReaction.post_id == post.id)
            )
            reactions_count = reactions_result.scalar() or 0

            shares_result = await self.db.execute(
                select(func.count(Share.id)).where(Share.post_id == post.id)
            )
            shares_count = shares_result.scalar() or 0

            # Calculate score with unread boost
            score = await self.calculate_post_score(
                post, user_id, hearts_count, reactions_count, shares_count, consider_read_status, user_last_feed_view
            )

            unread_posts.append({
                'id': post.id,
                'author_id': post.author_id,
                'content': post.content,
                'post_style': post.post_style,
                'post_type': post.post_type.value,
                'image_url': post.image_url,
                'location': post.location,
                'location_data': post.location_data,
                'is_public': post.is_public,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'display_name': post.author.display_name,
                    'name': post.author.display_name or post.author.username,
                    'email': post.author.email,
                    'profile_image_url': post.author.profile_image_url
                } if post.author else None,
                'hearts_count': hearts_count,
                'reactions_count': reactions_count,
                'shares_count': shares_count,
                'algorithm_score': score,
                'is_read': False,  # These are unread by definition
                'is_unread': True  # Mark as unread for frontend
            })

        # Sort by algorithm score (which includes unread boost)
        unread_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
        
        logger.debug(f"Found {len(unread_posts)} unread posts for user {user_id} since {user_last_feed_view}")
        return unread_posts

    async def update_user_last_feed_view(self, user_id: int) -> None:
        """Update user's last feed view timestamp to current time."""
        user = await self.get_by_id_or_404(User, user_id, "User")
        current_time = datetime.now(timezone.utc)
        user.last_feed_view = current_time
        await self.db.commit()
        logger.debug(f"Updated last_feed_view for user {user_id} to {current_time}")

    async def update_post_scores_batch(self, post_ids: List[str]) -> Dict[str, float]:
        """
        Update scores for multiple posts (useful for batch operations).
        
        Args:
            post_ids: List of post IDs to update scores for
            
        Returns:
            Dict[str, float]: Mapping of post_id to calculated score
        """
        scores = {}
        
        for post_id in post_ids:
            post = await self.get_by_id(Post, post_id, load_relationships=['author'])
            if post:
                score = await self.calculate_post_score(post)
                scores[post_id] = score
                
        logger.info(f"Updated scores for {len(scores)} posts")
        return scores

    async def get_trending_posts(
        self, 
        user_id: Optional[int] = None, 
        limit: int = 10,
        time_window_hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get trending posts based on recent engagement within a time window.
        
        Args:
            user_id: Optional user ID for personalization
            limit: Maximum number of trending posts
            time_window_hours: Time window in hours to consider for trending
            
        Returns:
            List[Dict[str, Any]]: Trending posts with scores
        """
        
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=time_window_hours)
        
        # Query posts created within the time window with engagement
        from sqlalchemy.orm import outerjoin
        
        query = select(
            Post,
            func.count(Like.id).label('hearts_count'),
            func.count(EmojiReaction.id).label('reactions_count'),
            func.count(Share.id).label('shares_count')
        ).select_from(
            outerjoin(
                outerjoin(
                    outerjoin(Post, Like, and_(Post.id == Like.post_id, Like.created_at >= cutoff_time)),
                    EmojiReaction, and_(Post.id == EmojiReaction.post_id, EmojiReaction.created_at >= cutoff_time)
                ),
                Share, and_(Post.id == Share.post_id, Share.created_at >= cutoff_time)
            )
        ).where(
            and_(
                Post.is_public == True,
                Post.created_at >= cutoff_time
            )
        ).group_by(Post.id).options(
            selectinload(Post.author)
        )

        result = await self.db.execute(query)
        posts_data = result.all()

        # Calculate trending scores (emphasize recent engagement)
        trending_posts = []
        for row in posts_data:
            post = row.Post
            hearts_count = row.hearts_count or 0
            reactions_count = row.reactions_count or 0
            shares_count = row.shares_count or 0

            # Calculate trending score using configurable weights (doubled for trending)
            scoring_weights = self.config.scoring_weights
            base_engagement = (
                (hearts_count * scoring_weights.hearts * 2.0) + 
                (reactions_count * scoring_weights.reactions * 2.0) + 
                (shares_count * scoring_weights.shares * 2.0)
            )
            
            # Only include posts with actual engagement
            if base_engagement > 0:
                # Add recency bonus using configurable time factors
                post_created_at = post.created_at
                if post_created_at.tzinfo is None:
                    # Handle timezone-naive datetime by assuming UTC
                    post_created_at = post_created_at.replace(tzinfo=timezone.utc)
                
                hours_old = (datetime.now(timezone.utc) - post_created_at).total_seconds() / 3600
                time_factors = self.config.time_factors
                
                # Apply time-based boosts
                if hours_old <= 1:
                    recency_bonus = time_factors.recent_boost_1hr
                elif hours_old <= 6:
                    recency_bonus = time_factors.recent_boost_6hr
                elif hours_old <= 24:
                    recency_bonus = time_factors.recent_boost_24hr
                else:
                    recency_bonus = max(0, (time_window_hours - hours_old) / time_window_hours * 2.0)
                
                trending_score = base_engagement + recency_bonus
                trending_posts.append({
                    'id': post.id,
                    'author_id': post.author_id,
                    'content': post.content,
                    'post_type': post.post_type.value,
                    'image_url': post.image_url,
                    'location': post.location,
                    'location_data': post.location_data,
                    'is_public': post.is_public,
                    'created_at': post.created_at.isoformat() if post.created_at else None,
                    'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                    'author': {
                        'id': post.author.id,
                        'username': post.author.username,
                        'display_name': post.author.display_name,
                        'name': post.author.display_name or post.author.username,
                        'email': post.author.email,
                        'profile_image_url': post.author.profile_image_url
                    } if post.author else None,
                    'hearts_count': hearts_count,
                    'reactions_count': reactions_count,
                    'shares_count': shares_count,
                    'trending_score': trending_score
                })

        # Sort by trending score and return top posts
        trending_posts.sort(key=lambda x: x['trending_score'], reverse=True)
        
        logger.info(f"Found {len(trending_posts)} trending posts in last {time_window_hours} hours")
        return trending_posts[:limit]
    
    def _apply_diversity_and_own_post_factors(
        self, 
        posts: List[Dict[str, Any]], 
        user_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """
        Apply diversity limits and own post factors to the post list.
        
        Args:
            posts: List of posts with scores
            user_id: Current user ID for own post detection
            
        Returns:
            List[Dict[str, Any]]: Posts with updated scores and diversity applied
        """
        import random
        
        diversity_config = self.config.diversity_limits
        own_post_config = self.config.own_post_factors
        
        # Apply own post factors
        current_time = datetime.now(timezone.utc)
        for post in posts:
            if user_id and post['author_id'] == user_id:
                # Calculate time since post creation
                post_time_str = post['created_at']
                if post_time_str.endswith('Z'):
                    post_time = datetime.fromisoformat(post_time_str.replace('Z', '+00:00'))
                elif '+' in post_time_str or post_time_str.endswith('00:00'):
                    post_time = datetime.fromisoformat(post_time_str)
                else:
                    # Handle timezone-naive datetime by assuming UTC
                    post_time = datetime.fromisoformat(post_time_str).replace(tzinfo=timezone.utc)
                
                minutes_old = (current_time - post_time).total_seconds() / 60
                
                # Apply own post multiplier
                if minutes_old <= own_post_config.max_visibility_minutes:
                    # Maximum boost for very recent own posts
                    multiplier = own_post_config.max_bonus_multiplier
                elif minutes_old <= own_post_config.decay_duration_minutes:
                    # Decaying boost
                    decay_factor = (own_post_config.decay_duration_minutes - minutes_old) / own_post_config.decay_duration_minutes
                    multiplier = own_post_config.base_multiplier + (own_post_config.max_bonus_multiplier - own_post_config.base_multiplier) * decay_factor
                else:
                    # Base multiplier for older own posts
                    multiplier = own_post_config.base_multiplier
                
                post['algorithm_score'] *= multiplier
                logger.debug(f"Applied own post multiplier {multiplier:.2f} to post {post['id']}")
        
        # Apply randomization factor for diversity
        randomization_factor = diversity_config.randomization_factor
        for post in posts:
            # Add random variation to scores (±randomization_factor%)
            variation = random.uniform(-randomization_factor, randomization_factor)
            post['algorithm_score'] *= (1 + variation)
        
        # Apply author diversity limits
        author_post_counts = {}
        filtered_posts = []
        
        for post in sorted(posts, key=lambda x: x['algorithm_score'], reverse=True):
            author_id = post['author_id']
            current_count = author_post_counts.get(author_id, 0)
            
            if current_count < diversity_config.max_posts_per_author:
                filtered_posts.append(post)
                author_post_counts[author_id] = current_count + 1
            else:
                logger.debug(f"Filtered out post {post['id']} due to author diversity limit")
        
        logger.debug(f"Applied diversity filters: {len(posts)} -> {len(filtered_posts)} posts")
        return filtered_posts
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get current algorithm configuration summary for debugging."""
        from app.config.algorithm_config import get_config_manager
        return get_config_manager().get_config_summary()