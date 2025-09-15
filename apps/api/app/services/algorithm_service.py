"""
Algorithm service for calculating post engagement scores and feed ranking.
"""

import logging
import random
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

        # Base score starts at 1.0 for proper multiplicative scaling
        base_score = 1.0
        
        # Engagement multiplier using configurable weights with cap to prevent explosive growth
        scoring_weights = self.config.scoring_weights
        engagement_points = (
            (hearts_count * scoring_weights.hearts) + 
            (reactions_count * scoring_weights.reactions) + 
            (shares_count * scoring_weights.shares)
        )
        engagement_multiplier = min(1.0 + engagement_points, scoring_weights.max_engagement_multiplier)
        
        # Content type multipliers using configurable values
        content_multiplier = 1.0
        if post.post_type == PostType.photo:
            content_multiplier += scoring_weights.photo_bonus
        elif post.post_type == PostType.daily:
            content_multiplier += scoring_weights.daily_gratitude_bonus
        
        # Enhanced time factoring for recent posts
        time_multiplier = self._calculate_time_factor(post)
        
        # Enhanced relationship multiplier using configurable follow bonuses
        relationship_multiplier = 1.0
        if user_id and post.author_id != user_id:
            relationship_multiplier = await self._calculate_follow_relationship_multiplier(user_id, post.author_id)

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

        # Apply mention multiplier if current user is mentioned in the post
        mention_multiplier = 1.0
        if user_id and post.author_id != user_id:
            mention_bonus = await self._calculate_mention_bonus(user_id, post.id)
            if mention_bonus > 0:
                mention_multiplier = 1.0 + mention_bonus  # Convert bonus to multiplier

        # Apply own post multiplier if this is the user's own post
        own_post_multiplier = 1.0
        if user_id and post.author_id == user_id:
            # Calculate time since post creation
            current_time = datetime.now(timezone.utc)
            post_created_at = post.created_at
            if post_created_at.tzinfo is None:
                post_created_at = post_created_at.replace(tzinfo=timezone.utc)
            
            minutes_old = (current_time - post_created_at).total_seconds() / 60
            own_post_multiplier = self._calculate_own_post_bonus(minutes_old)
        
        # Calculate final score using pure multiplicative approach
        final_score = (
            base_score * 
            engagement_multiplier * 
            content_multiplier * 
            mention_multiplier * 
            relationship_multiplier * 
            unread_multiplier * 
            time_multiplier * 
            own_post_multiplier
        )
        
        # Check if engagement cap was applied
        uncapped_engagement = 1.0 + engagement_points
        engagement_capped = engagement_multiplier < uncapped_engagement
        
        logger.debug(
            f"Post {post.id} score calculation: "
            f"base={base_score:.2f}, engagement={engagement_multiplier:.2f} (hearts={hearts_count}, reactions={reactions_count}, shares={shares_count}"
            f"{', CAPPED' if engagement_capped else ''}), "
            f"content={content_multiplier:.2f}, mention={mention_multiplier:.2f}, "
            f"relationship={relationship_multiplier:.2f}, unread={unread_multiplier:.2f}, "
            f"time={time_multiplier:.2f}, own_post={own_post_multiplier:.2f}, final={final_score:.2f}"
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
        
        # Apply graduated time bonuses for recent posts with finer granularity
        recency_bonus = 0.0
        if hours_old <= 0.1:  # First 6 minutes get extra boost
            recency_bonus = time_factors.recent_boost_1hr + 2.0  # Extra boost for very recent
        elif hours_old <= 1:
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

    async def _calculate_follow_relationship_multiplier(self, user_id: int, post_author_id: int) -> float:
        """
        Calculate enhanced follow relationship multiplier with graduated bonuses,
        recency factors, engagement tracking, and second-tier follow detection.
        
        Args:
            user_id: ID of the user viewing the feed
            post_author_id: ID of the post author
            
        Returns:
            float: Relationship multiplier (1.0 = no relationship, >1.0 = follow bonus)
        """
        # Check direct follow relationship
        follow_result = await self.db.execute(
            select(Follow).where(
                and_(
                    Follow.follower_id == user_id,
                    Follow.followed_id == post_author_id,
                    Follow.status == "active"
                )
            )
        )
        direct_follow = follow_result.scalar_one_or_none()
        
        if direct_follow:
            # Calculate graduated follow bonus based on follow age and engagement
            return await self._calculate_direct_follow_bonus(user_id, post_author_id, direct_follow)
        
        # Check for second-tier follow relationship (users followed by your follows)
        second_tier_multiplier = await self._calculate_second_tier_follow_bonus(user_id, post_author_id)
        if second_tier_multiplier > 1.0:
            return second_tier_multiplier
        
        return 1.0  # No relationship bonus

    async def _calculate_direct_follow_bonus(self, user_id: int, post_author_id: int, follow: Follow) -> float:
        """
        Calculate direct follow bonus with graduated bonuses, recency, and engagement factors.
        
        Args:
            user_id: ID of the follower
            post_author_id: ID of the followed user
            follow: Follow relationship object
            
        Returns:
            float: Direct follow multiplier
        """
        follow_bonuses = self.config.follow_bonuses
        current_time = datetime.now(timezone.utc)
        
        # Handle timezone-aware comparison
        follow_created_at = follow.created_at
        if follow_created_at.tzinfo is None:
            follow_created_at = follow_created_at.replace(tzinfo=timezone.utc)
        
        days_following = (current_time - follow_created_at).days
        
        # Determine follow age category and base bonus
        base_multiplier = follow_bonuses.base_multiplier
        if days_following <= follow_bonuses.new_follow_threshold_days:
            # New follow bonus
            base_multiplier = follow_bonuses.new_follow_bonus
        elif days_following <= follow_bonuses.established_follow_threshold_days:
            # Established follow bonus
            base_multiplier = follow_bonuses.established_follow_bonus
        
        # Check for mutual follow relationship
        mutual_follow_result = await self.db.execute(
            select(Follow.id).where(
                and_(
                    Follow.follower_id == post_author_id,
                    Follow.followed_id == user_id,
                    Follow.status == "active"
                )
            )
        )
        if mutual_follow_result.scalar_one_or_none():
            # Apply mutual follow bonus (highest priority)
            base_multiplier = follow_bonuses.mutual_follow_bonus
        
        # Apply recent follow boost if within recent follow days
        recency_multiplier = 1.0
        if days_following <= follow_bonuses.recent_follow_days:
            recency_multiplier = 1.0 + follow_bonuses.recent_follow_boost
        
        # Calculate engagement bonus based on user interactions
        engagement_multiplier = await self._calculate_follow_engagement_bonus(user_id, post_author_id)
        
        # Combine all factors
        final_multiplier = base_multiplier * recency_multiplier * engagement_multiplier
        
        logger.debug(
            f"Direct follow bonus for user {user_id} -> {post_author_id}: "
            f"days_following={days_following}, base={base_multiplier:.2f}, "
            f"recency={recency_multiplier:.2f}, engagement={engagement_multiplier:.2f}, "
            f"final={final_multiplier:.2f}"
        )
        
        return final_multiplier

    async def _calculate_follow_engagement_bonus(self, user_id: int, target_user_id: int) -> float:
        """
        Calculate engagement bonus based on user interaction history.
        
        Args:
            user_id: ID of the user
            target_user_id: ID of the target user
            
        Returns:
            float: Engagement multiplier (1.0 = no bonus, >1.0 = high engagement bonus)
        """
        from app.models.user_interaction import UserInteraction
        
        follow_bonuses = self.config.follow_bonuses
        
        # Count interactions between users in the last 30 days
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        interaction_result = await self.db.execute(
            select(func.count(UserInteraction.id)).where(
                and_(
                    UserInteraction.user_id == user_id,
                    UserInteraction.target_user_id == target_user_id,
                    UserInteraction.created_at >= thirty_days_ago
                )
            )
        )
        interaction_count = interaction_result.scalar() or 0
        
        # Apply high engagement bonus if above threshold
        if interaction_count >= follow_bonuses.high_engagement_threshold:
            engagement_multiplier = 1.0 + follow_bonuses.high_engagement_bonus
            logger.debug(
                f"High engagement bonus applied for user {user_id} -> {target_user_id}: "
                f"interactions={interaction_count}, multiplier={engagement_multiplier:.2f}"
            )
            return engagement_multiplier
        
        return 1.0

    async def _calculate_second_tier_follow_bonus(self, user_id: int, post_author_id: int) -> float:
        """
        Calculate second-tier follow bonus for users followed by your follows.
        
        Uses efficient database query to detect second-tier relationships:
        SELECT DISTINCT f2.followed_id as second_tier_user_id
        FROM follows f1 
        JOIN follows f2 ON f1.followed_id = f2.follower_id 
        WHERE f1.follower_id = :current_user_id 
        AND f2.followed_id != :current_user_id
        
        Args:
            user_id: ID of the current user
            post_author_id: ID of the post author to check
            
        Returns:
            float: Second-tier follow multiplier
        """
        follow_bonuses = self.config.follow_bonuses
        
        # Create aliases for the two Follow tables in the join
        f1 = Follow.__table__.alias('f1')
        f2 = Follow.__table__.alias('f2')
        
        # Efficient query to check if post_author_id is followed by any of user's follows
        second_tier_result = await self.db.execute(
            select(f2.c.id).select_from(
                f1.join(f2, f1.c.followed_id == f2.c.follower_id)
            ).where(
                and_(
                    f1.c.follower_id == user_id,
                    f2.c.followed_id == post_author_id,
                    f2.c.followed_id != user_id,  # Exclude self
                    f1.c.status == "active",
                    f2.c.status == "active"
                )
            ).limit(1)
        )
        
        if second_tier_result.scalar_one_or_none():
            logger.debug(
                f"Second-tier follow bonus applied for user {user_id} -> {post_author_id}: "
                f"multiplier={follow_bonuses.second_tier_multiplier:.2f}"
            )
            return follow_bonuses.second_tier_multiplier
        
        return 1.0

    async def _calculate_mention_bonus(self, user_id: int, post_id: str) -> float:
        """
        Calculate mention bonus for posts where the current user is mentioned.
        
        Uses efficient database query to detect mentions:
        SELECT post_id FROM mentions WHERE mentioned_user_id = :current_user_id AND post_id = :post_id
        
        Args:
            user_id: ID of the current user
            post_id: ID of the post to check for mentions
            
        Returns:
            float: Mention bonus (0.0 if not mentioned, configured bonus if mentioned)
        """
        from app.models.mention import Mention
        
        mention_bonuses = self.config.mention_bonuses
        
        # Efficient query to check if current user is mentioned in this post
        mention_result = await self.db.execute(
            select(Mention.id).where(
                and_(
                    Mention.mentioned_user_id == user_id,
                    Mention.post_id == post_id
                )
            ).limit(1)
        )
        
        if mention_result.scalar_one_or_none():
            logger.debug(
                f"Mention bonus applied for user {user_id} in post {post_id}: "
                f"bonus={mention_bonuses.direct_mention:.2f}"
            )
            return mention_bonuses.direct_mention
        
        return 0.0

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

        # Apply diversity limits and preference control
        scored_posts = await self._apply_diversity_and_preference_control(scored_posts, user_id)
        
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
    
    def _calculate_own_post_bonus(self, minutes_old: float) -> float:
        """
        Calculate own post bonus using exponential decay formula.
        
        Formula: own_post_bonus = max(base_multiplier, max_bonus * decay_factor) + base_multiplier
        
        Args:
            minutes_old: Minutes since post creation
            
        Returns:
            float: Own post bonus multiplier
        """
        own_post_config = self.config.own_post_factors
        
        if minutes_old <= own_post_config.max_visibility_minutes:
            # Maximum boost for very recent own posts
            return own_post_config.max_bonus_multiplier + own_post_config.base_multiplier
        elif minutes_old <= own_post_config.decay_duration_minutes:
            # Exponential decay from max_bonus to base_multiplier
            # Calculate decay progress (0 to 1)
            decay_progress = (minutes_old - own_post_config.max_visibility_minutes) / (
                own_post_config.decay_duration_minutes - own_post_config.max_visibility_minutes
            )
            
            # Exponential decay factor: starts at 1.0, decays to 0
            decay_factor = (1.0 - decay_progress) ** 2  # Quadratic decay for smoother transition
            
            # Apply decay formula: max(base_multiplier, max_bonus * decay_factor) + base_multiplier
            decayed_bonus = max(
                own_post_config.base_multiplier,
                own_post_config.max_bonus_multiplier * decay_factor
            )
            
            return decayed_bonus + own_post_config.base_multiplier
        else:
            # Permanent base multiplier for older own posts
            return own_post_config.base_multiplier + own_post_config.base_multiplier

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
        
        # Apply own post factors with exponential decay
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
                
                # Calculate own post bonus using exponential decay
                multiplier = self._calculate_own_post_bonus(minutes_old)
                
                # Store original score for debugging
                original_score = post['algorithm_score']
                post['algorithm_score'] *= multiplier
                
                # Add strong time-based component to ensure chronological order
                # Use seconds precision for very fine-grained ordering
                seconds_old = (current_time - post_time).total_seconds()
                # Create a large time component that decreases by 1 for each second
                # This ensures even 1-second differences create clear ordering
                time_component = max(0, 100000 - seconds_old)  # Large range to dominate other factors
                post['algorithm_score'] += time_component
                
                # Add metadata for frontend visual feedback
                post['is_own_post'] = True
                post['own_post_bonus'] = multiplier
                post['minutes_old'] = minutes_old
                
                logger.debug(
                    f"Applied own post bonus to post {post['id']}: "
                    f"minutes_old={minutes_old:.1f}, multiplier={multiplier:.2f}, "
                    f"time_component={time_component:.3f}, "
                    f"score: {original_score:.2f} -> {post['algorithm_score']:.2f}"
                )
        
        # Apply randomization factor for diversity, but skip it entirely for own posts
        randomization_factor = diversity_config.randomization_factor
        for post in posts:
            # Skip randomization entirely for own posts to maintain strict chronological order
            if user_id and post['author_id'] == user_id:
                # No randomization for own posts - maintain exact chronological order
                pass
            else:
                # Normal randomization for other posts
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
    
    def get_own_post_visibility_status(self, post_id: str, user_id: int) -> Dict[str, Any]:
        """
        Get visibility status for user's own post for frontend feedback.
        
        Args:
            post_id: ID of the post to check
            user_id: ID of the user
            
        Returns:
            Dict[str, Any]: Visibility status with timing and bonus information
        """
        # This would typically be called after getting a post
        # For now, return a placeholder that can be used by the frontend
        own_post_config = self.config.own_post_factors
        
        return {
            "max_visibility_minutes": own_post_config.max_visibility_minutes,
            "decay_duration_minutes": own_post_config.decay_duration_minutes,
            "max_bonus_multiplier": own_post_config.max_bonus_multiplier,
            "base_multiplier": own_post_config.base_multiplier
        }

    async def get_post_with_visibility_status(
        self, 
        post_id: str, 
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get a post with its current visibility status for the user.
        
        Args:
            post_id: ID of the post
            user_id: ID of the user
            
        Returns:
            Optional[Dict[str, Any]]: Post data with visibility status, or None if not found
        """
        post = await self.get_by_id(Post, post_id, load_relationships=['author'])
        if not post:
            return None
        
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

        # Calculate algorithm score
        algorithm_score = await self.calculate_post_score(
            post, user_id, hearts_count, reactions_count, shares_count
        )

        # Calculate own post visibility status
        is_own_post = post.author_id == user_id
        own_post_status = None
        
        if is_own_post:
            current_time = datetime.now(timezone.utc)
            post_created_at = post.created_at
            if post_created_at.tzinfo is None:
                post_created_at = post_created_at.replace(tzinfo=timezone.utc)
            
            minutes_old = (current_time - post_created_at).total_seconds() / 60
            own_post_bonus = self._calculate_own_post_bonus(minutes_old)
            
            own_post_config = self.config.own_post_factors
            
            # Determine visibility phase
            if minutes_old <= own_post_config.max_visibility_minutes:
                phase = "max_visibility"
            elif minutes_old <= own_post_config.decay_duration_minutes:
                phase = "decaying"
            else:
                phase = "base_visibility"
            
            own_post_status = {
                "is_own_post": True,
                "minutes_old": minutes_old,
                "bonus_multiplier": own_post_bonus,
                "phase": phase,
                "max_visibility_minutes": own_post_config.max_visibility_minutes,
                "decay_duration_minutes": own_post_config.decay_duration_minutes,
                "time_remaining_max": max(0, own_post_config.max_visibility_minutes - minutes_old),
                "time_remaining_decay": max(0, own_post_config.decay_duration_minutes - minutes_old)
            }

        return {
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
            'algorithm_score': algorithm_score,
            'own_post_status': own_post_status
        }

    async def _apply_diversity_and_preference_control(
        self, 
        scored_posts: List[Dict[str, Any]], 
        user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Apply diversity limits and preference control to scored posts.
        
        Args:
            scored_posts: List of posts with scores
            user_id: ID of the user viewing the feed
            
        Returns:
            List[Dict[str, Any]]: Posts with diversity and preference adjustments
        """
        try:
            # Import here to avoid circular imports
            from app.services.user_preference_service import UserPreferenceService
            
            preference_service = UserPreferenceService(self.db)
            diversity_config = self.config.diversity_limits
            
            # Apply preference boosts first (but only for non-followed users to avoid double-boosting)
            for post in scored_posts:
                if post['author_id'] != user_id:  # Don't boost own posts
                    try:
                        # Check if this post already received a follow relationship multiplier
                        # If so, skip preference boost to avoid double-boosting
                        follow_multiplier = await self._calculate_follow_relationship_multiplier(
                            user_id, post['author_id']
                        )
                        
                        # Only apply preference boost if there's no significant follow relationship
                        if follow_multiplier <= 1.1:  # Allow small boosts but not major follow bonuses
                            preference_boost = await preference_service.calculate_preference_boost(
                                user_id, post['author_id']
                            )
                            post['algorithm_score'] *= preference_boost
                            if preference_boost > 1.0:
                                post['preference_boosted'] = True
                        else:
                            logger.debug(f"Skipping preference boost for post {post['id']} - already has follow multiplier {follow_multiplier:.2f}")
                    except Exception as e:
                        logger.warning(f"Failed to calculate preference boost: {e}")
                        # Continue without preference boost
            
            # Apply randomization factor to prevent predictable feeds
            randomization_factor = diversity_config.randomization_factor
            for post in scored_posts:
                # Skip randomization for own posts to ensure they always rank correctly
                if post['author_id'] == user_id:
                    continue
                # Apply ±15% randomization (or configured percentage)
                random_multiplier = 1.0 + random.uniform(-randomization_factor, randomization_factor)
                post['algorithm_score'] *= random_multiplier
            
            # Sort by updated scores
            scored_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
            
            # Apply diversity limits
            diversified_posts = self._apply_author_diversity_limits(scored_posts, diversity_config)
            diversified_posts = self._apply_content_type_balancing(diversified_posts, diversity_config)
            
            # Apply spacing rules to prevent consecutive posts by same user
            spaced_posts = self._apply_spacing_rules(diversified_posts, diversity_config)
            
            return spaced_posts
            
        except Exception as e:
            logger.error(f"Error in diversity and preference control: {e}")
            # Return original posts if diversity control fails
            return scored_posts

    def _apply_author_diversity_limits(
        self, 
        posts: List[Dict[str, Any]], 
        diversity_config
    ) -> List[Dict[str, Any]]:
        """
        Apply maximum posts per author limit to ensure feed diversity.
        
        Args:
            posts: List of posts to filter
            diversity_config: Diversity configuration
            
        Returns:
            List[Dict[str, Any]]: Filtered posts with author diversity
        """
        max_posts_per_author = diversity_config.max_posts_per_author
        author_counts = {}
        filtered_posts = []
        
        for post in posts:
            author_id = post['author_id']
            current_count = author_counts.get(author_id, 0)
            
            if current_count < max_posts_per_author:
                filtered_posts.append(post)
                author_counts[author_id] = current_count + 1
            else:
                logger.debug(f"Filtered out post from author {author_id} due to diversity limit")
        
        logger.debug(
            f"Applied author diversity: {len(posts)} -> {len(filtered_posts)} posts "
            f"(max {max_posts_per_author} per author)"
        )
        
        return filtered_posts

    def _apply_content_type_balancing(
        self, 
        posts: List[Dict[str, Any]], 
        diversity_config
    ) -> List[Dict[str, Any]]:
        """
        Apply content type balancing to ensure diverse post types in feed.
        
        Args:
            posts: List of posts to balance
            diversity_config: Diversity configuration
            
        Returns:
            List[Dict[str, Any]]: Balanced posts with content type diversity
        """
        if not posts:
            return posts
        
        total_posts = len(posts)
        
        # Calculate limits for each post type (ensure at least 1 for small datasets)
        photo_limit = max(1, int(total_posts * diversity_config.max_photo_posts_percentage))
        daily_limit = max(1, int(total_posts * diversity_config.max_daily_posts_percentage))
        spontaneous_limit = max(1, int(total_posts * diversity_config.max_spontaneous_posts_percentage))
        
        # For small datasets (< 10 posts), be more lenient with balancing
        if total_posts < 10:
            photo_limit = total_posts
            daily_limit = total_posts
            spontaneous_limit = total_posts
        
        # Count posts by type and apply limits
        type_counts = {'photo': 0, 'daily': 0, 'spontaneous': 0}
        balanced_posts = []
        
        for post in posts:
            post_type = post['post_type']
            current_count = type_counts.get(post_type, 0)
            
            # Check if we can add this post type
            can_add = True
            if post_type == 'photo' and current_count >= photo_limit:
                can_add = False
            elif post_type == 'daily' and current_count >= daily_limit:
                can_add = False
            elif post_type == 'spontaneous' and current_count >= spontaneous_limit:
                can_add = False
            
            if can_add:
                balanced_posts.append(post)
                type_counts[post_type] = current_count + 1
            else:
                logger.debug(f"Filtered out {post_type} post due to content type balancing")
        
        logger.debug(
            f"Applied content type balancing: {len(posts)} -> {len(balanced_posts)} posts "
            f"(photo: {type_counts['photo']}/{photo_limit}, "
            f"daily: {type_counts['daily']}/{daily_limit}, "
            f"spontaneous: {type_counts['spontaneous']}/{spontaneous_limit})"
        )
        
        return balanced_posts

    def _apply_spacing_rules(
        self, 
        posts: List[Dict[str, Any]], 
        diversity_config
    ) -> List[Dict[str, Any]]:
        """
        Apply spacing rules to prevent consecutive posts by the same user.
        
        Uses a sliding window approach to detect spacing violations and applies
        penalty multipliers to posts that violate spacing rules.
        
        Args:
            posts: List of posts sorted by score (descending)
            diversity_config: Diversity configuration with spacing parameters
            
        Returns:
            List[Dict[str, Any]]: Posts with spacing rule penalties applied and re-sorted
        """
        if not posts or len(posts) <= 1:
            return posts
        
        max_consecutive = diversity_config.max_consecutive_posts_per_user
        window_size = diversity_config.spacing_window_size
        penalty_multiplier = diversity_config.spacing_violation_penalty
        
        # Track author distribution within sliding window
        spaced_posts = []
        
        for i, post in enumerate(posts):
            author_id = post['author_id']
            
            # Calculate sliding window start position
            window_start = max(0, len(spaced_posts) - window_size + 1)
            window_posts = spaced_posts[window_start:]
            
            # Count posts by this author in the current window
            author_count_in_window = sum(1 for p in window_posts if p['author_id'] == author_id)
            
            # Check for consecutive posts violation
            consecutive_count = 0
            for j in range(len(spaced_posts) - 1, -1, -1):
                if spaced_posts[j]['author_id'] == author_id:
                    consecutive_count += 1
                else:
                    break
            
            # Apply penalty if spacing rules are violated
            post_copy = post.copy()
            spacing_penalty_applied = False
            
            # Apply penalty if spacing rules are violated
            # Violation 1: Too many consecutive posts
            if consecutive_count >= max_consecutive:
                post_copy['algorithm_score'] *= penalty_multiplier
                spacing_penalty_applied = True
                logger.debug(
                    f"Applied consecutive posts penalty to post {post['id']} "
                    f"(author {author_id}): {consecutive_count} consecutive posts, "
                    f"penalty={penalty_multiplier:.2f}"
                )
            
            # Violation 2: Too many posts in sliding window (additional check)
            elif author_count_in_window >= max_consecutive and window_size > max_consecutive:
                # Apply lighter penalty for window-based violations
                window_penalty = penalty_multiplier + (1.0 - penalty_multiplier) * 0.5  # 50% lighter
                post_copy['algorithm_score'] *= window_penalty
                spacing_penalty_applied = True
                logger.debug(
                    f"Applied window spacing penalty to post {post['id']} "
                    f"(author {author_id}): {author_count_in_window} posts in window of {window_size}, "
                    f"penalty={window_penalty:.2f}"
                )
            
            # Mark if spacing penalty was applied for debugging
            if spacing_penalty_applied:
                post_copy['spacing_penalty_applied'] = True
                post_copy['spacing_penalty_reason'] = (
                    f"consecutive={consecutive_count}" if consecutive_count >= max_consecutive
                    else f"window={author_count_in_window}/{window_size}"
                )
            
            spaced_posts.append(post_copy)
        
        # Re-sort posts after applying spacing penalties
        spaced_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
        
        # Log spacing rule statistics
        penalty_count = sum(1 for p in spaced_posts if p.get('spacing_penalty_applied', False))
        if penalty_count > 0:
            logger.debug(
                f"Applied spacing rule penalties to {penalty_count}/{len(spaced_posts)} posts "
                f"(max_consecutive={max_consecutive}, window_size={window_size}, "
                f"penalty={penalty_multiplier:.2f})"
            )
        
        return spaced_posts

    async def get_diversity_stats(self, posts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get diversity statistics for a list of posts.
        
        Args:
            posts: List of posts to analyze
            
        Returns:
            Dict[str, Any]: Diversity statistics
        """
        if not posts:
            return {
                'total_posts': 0,
                'unique_authors': 0,
                'content_type_distribution': {},
                'author_distribution': {}
            }
        
        # Count unique authors
        unique_authors = len(set(post['author_id'] for post in posts))
        
        # Count posts by content type
        content_type_counts = {}
        for post in posts:
            post_type = post['post_type']
            content_type_counts[post_type] = content_type_counts.get(post_type, 0) + 1
        
        # Count posts by author
        author_counts = {}
        for post in posts:
            author_id = post['author_id']
            author_counts[author_id] = author_counts.get(author_id, 0) + 1
        
        # Calculate percentages
        total_posts = len(posts)
        content_type_percentages = {
            post_type: (count / total_posts) * 100
            for post_type, count in content_type_counts.items()
        }
        
        # Check for spacing rule violations and penalties
        spacing_penalties = sum(1 for post in posts if post.get('spacing_penalty_applied', False))
        consecutive_violations = []
        
        # Analyze consecutive post patterns
        for i in range(1, len(posts)):
            if posts[i]['author_id'] == posts[i-1]['author_id']:
                consecutive_violations.append({
                    'position': i,
                    'author_id': posts[i]['author_id'],
                    'post_id': posts[i]['id']
                })
        
        return {
            'total_posts': total_posts,
            'unique_authors': unique_authors,
            'author_diversity_ratio': unique_authors / total_posts if total_posts > 0 else 0,
            'content_type_distribution': content_type_percentages,
            'content_type_counts': content_type_counts,
            'author_distribution': dict(sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
            'max_posts_per_author': max(author_counts.values()) if author_counts else 0,
            'spacing_statistics': {
                'spacing_penalties_applied': spacing_penalties,
                'consecutive_violations_detected': len(consecutive_violations),
                'consecutive_violations': consecutive_violations[:5]  # Show first 5 for debugging
            }
        }

    def get_config_summary(self) -> Dict[str, Any]:
        """Get current algorithm configuration summary for debugging."""
        from app.config.algorithm_config import get_config_manager
        return get_config_manager().get_config_summary()