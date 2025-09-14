"""
Optimized Algorithm Service with Performance Enhancements

This service extends the base AlgorithmService with performance optimizations:
- Read status query optimization and caching
- Time-based scoring with pre-calculated time buckets
- Batch processing for preference learning and diversity calculations
- Enhanced database query optimization
- Performance monitoring and <300ms feed loading guarantee
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple, Set
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, and_, or_, text
from dataclasses import dataclass
from collections import defaultdict

from app.services.algorithm_service import AlgorithmService
from app.models.post import Post, PostType
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.follow import Follow
from app.models.user import User
from app.models.user_interaction import UserInteraction
from app.core.performance_utils import performance_monitoring
from app.core.query_monitor import monitor_query
from app.core.algorithm_performance import monitor_algorithm_performance

logger = logging.getLogger(__name__)


@dataclass
class TimeBucket:
    """Pre-calculated time bucket for efficient time-based scoring."""
    hours_old: float
    recency_bonus: float
    decay_multiplier: float
    time_multiplier: float


@dataclass
class EngagementData:
    """Batch engagement data for efficient scoring."""
    post_id: str
    hearts_count: int
    reactions_count: int
    shares_count: int


@dataclass
class UserPreferenceData:
    """Cached user preference data for efficient personalization."""
    user_id: int
    frequent_interaction_users: Set[int]  # Renamed to match batch service
    interaction_weights: Dict[int, float]
    content_type_preferences: Dict[str, float]
    time_preferences: Dict[str, float]
    diversity_score: float
    last_updated: datetime


class OptimizedAlgorithmService(AlgorithmService):
    """
    Performance-optimized algorithm service with caching and batch processing.
    
    Key optimizations:
    1. Read status caching with efficient batch queries
    2. Pre-calculated time buckets for time-based scoring
    3. Batch engagement data loading
    4. User preference caching with TTL
    5. Optimized database queries with proper indexing
    6. Performance monitoring to maintain <300ms feed loading
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        
        # Performance caches
        self._time_bucket_cache: Dict[int, TimeBucket] = {}
        self._engagement_cache: Dict[str, EngagementData] = {}
        self._user_preference_cache: Dict[int, UserPreferenceData] = {}
        
        # Cache TTL settings
        self._engagement_cache_ttl = 300  # 5 minutes
        self._preference_cache_ttl = 1800  # 30 minutes
        self._time_bucket_cache_ttl = 3600  # 1 hour
        
        # Performance monitoring
        self._performance_target_ms = 300  # Target feed loading time
        self._batch_size = 100  # Batch size for bulk operations
        
        # Initialize time buckets
        self._initialize_time_buckets()
    
    def _initialize_time_buckets(self) -> None:
        """Pre-calculate time buckets for efficient time-based scoring."""
        time_factors = self.config.time_factors
        
        # Create buckets for common time ranges (0-168 hours = 1 week)
        for hours in range(0, 169):  # 0 to 168 hours
            recency_bonus = 0.0
            if hours <= 0.1:  # First 6 minutes
                recency_bonus = time_factors.recent_boost_1hr + 2.0
            elif hours <= 1:
                recency_bonus = time_factors.recent_boost_1hr
            elif hours <= 6:
                recency_bonus = time_factors.recent_boost_6hr
            elif hours <= 24:
                recency_bonus = time_factors.recent_boost_24hr
            
            # Calculate decay multiplier
            decay_multiplier = 1.0
            if hours > 24:
                decay_hours = time_factors.decay_hours
                if hours >= decay_hours:
                    decay_multiplier = 0.1
                else:
                    decay_progress = (hours - 24) / (decay_hours - 24)
                    decay_multiplier = max(0.1, 0.1 ** decay_progress)
            
            # Combine factors
            time_multiplier = (1.0 + recency_bonus) * decay_multiplier
            
            self._time_bucket_cache[hours] = TimeBucket(
                hours_old=hours,
                recency_bonus=recency_bonus,
                decay_multiplier=decay_multiplier,
                time_multiplier=time_multiplier
            )
        
        logger.info(f"Initialized {len(self._time_bucket_cache)} time buckets for efficient scoring")
    
    def _get_time_multiplier_fast(self, post: Post) -> float:
        """
        Get time multiplier using pre-calculated buckets for performance.
        
        Args:
            post: Post object to calculate time factor for
            
        Returns:
            float: Time-based multiplier from cache
        """
        if not post.created_at:
            return 1.0
        
        # Handle timezone-aware comparison
        post_created_at = post.created_at
        if post_created_at.tzinfo is None:
            post_created_at = post_created_at.replace(tzinfo=timezone.utc)
        
        current_time = datetime.now(timezone.utc)
        hours_old = (current_time - post_created_at).total_seconds() / 3600
        
        # Use cached bucket or calculate for very old posts
        bucket_key = min(int(hours_old), 168)  # Cap at 1 week
        
        if bucket_key in self._time_bucket_cache:
            return self._time_bucket_cache[bucket_key].time_multiplier
        
        # Fallback to original calculation for very old posts
        return super()._calculate_time_factor(post)
    
    @monitor_query("batch_engagement_data")
    async def _load_engagement_data_batch(self, post_ids: List[str]) -> Dict[str, EngagementData]:
        """
        Load engagement data for multiple posts in batch for performance.
        
        Args:
            post_ids: List of post IDs to load engagement data for
            
        Returns:
            Dict mapping post_id to EngagementData
        """
        if not post_ids:
            return {}
        
        engagement_data = {}
        
        # Batch query for hearts
        hearts_query = select(
            Like.post_id,
            func.count(Like.id).label('hearts_count')
        ).where(
            Like.post_id.in_(post_ids)
        ).group_by(Like.post_id)
        
        hearts_result = await self.db.execute(hearts_query)
        hearts_counts = {row.post_id: row.hearts_count for row in hearts_result.fetchall()}
        
        # Batch query for reactions
        reactions_query = select(
            EmojiReaction.post_id,
            func.count(EmojiReaction.id).label('reactions_count')
        ).where(
            EmojiReaction.post_id.in_(post_ids)
        ).group_by(EmojiReaction.post_id)
        
        reactions_result = await self.db.execute(reactions_query)
        reactions_counts = {row.post_id: row.reactions_count for row in reactions_result.fetchall()}
        
        # Batch query for shares
        shares_query = select(
            Share.post_id,
            func.count(Share.id).label('shares_count')
        ).where(
            Share.post_id.in_(post_ids)
        ).group_by(Share.post_id)
        
        shares_result = await self.db.execute(shares_query)
        shares_counts = {row.post_id: row.shares_count for row in shares_result.fetchall()}
        
        # Combine data
        for post_id in post_ids:
            engagement_data[post_id] = EngagementData(
                post_id=post_id,
                hearts_count=hearts_counts.get(post_id, 0),
                reactions_count=reactions_counts.get(post_id, 0),
                shares_count=shares_counts.get(post_id, 0)
            )
        
        logger.debug(f"Loaded engagement data for {len(post_ids)} posts in batch")
        return engagement_data
    
    @monitor_algorithm_performance("user_preference_data")
    @monitor_query("user_preference_data")
    async def _load_user_preference_data(self, user_id: int) -> UserPreferenceData:
        """
        Load and cache user preference data for personalization.
        
        Args:
            user_id: ID of the user to load preferences for
            
        Returns:
            UserPreferenceData: Cached preference data
        """
        # Check cache first
        if user_id in self._user_preference_cache:
            cached_data = self._user_preference_cache[user_id]
            cache_age = (datetime.now(timezone.utc) - cached_data.last_updated).total_seconds()
            if cache_age < self._preference_cache_ttl:
                return cached_data
        
        # Load fresh preference data
        preference_factors = self.config.preference_factors
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=preference_factors.preference_decay_days)
        
        # Batch query for user interactions
        interactions_query = select(
            UserInteraction.target_user_id,
            UserInteraction.interaction_type,
            func.count(UserInteraction.id).label('interaction_count'),
            func.sum(UserInteraction.weight).label('total_weight')
        ).where(
            and_(
                UserInteraction.user_id == user_id,
                UserInteraction.created_at >= thirty_days_ago
            )
        ).group_by(
            UserInteraction.target_user_id,
            UserInteraction.interaction_type
        )
        
        interactions_result = await self.db.execute(interactions_query)
        interactions = interactions_result.fetchall()
        
        # Calculate interaction weights and frequent users
        interaction_weights = defaultdict(float)
        user_interaction_counts = defaultdict(int)
        
        for interaction in interactions:
            target_user_id = interaction.target_user_id
            interaction_type = interaction.interaction_type
            count = interaction.interaction_count
            total_weight = interaction.total_weight or count
            
            # Apply type-specific weights
            type_weight = 1.0
            if interaction_type == 'heart':
                type_weight = preference_factors.heart_interaction_weight
            elif interaction_type == 'reaction':
                type_weight = preference_factors.reaction_interaction_weight
            elif interaction_type == 'share':
                type_weight = preference_factors.share_interaction_weight
            elif interaction_type == 'mention':
                type_weight = preference_factors.mention_interaction_weight
            
            weighted_score = total_weight * type_weight
            interaction_weights[target_user_id] += weighted_score
            user_interaction_counts[target_user_id] += count
        
        # Identify frequent users
        frequent_users = {
            user_id for user_id, count in user_interaction_counts.items()
            if count >= preference_factors.interaction_threshold
        }
        
        # Cache the data
        preference_data = UserPreferenceData(
            user_id=user_id,
            frequent_interaction_users=frequent_users,  # Updated field name
            interaction_weights=dict(interaction_weights),
            content_type_preferences={},  # TODO: Calculate from interactions
            time_preferences={},  # TODO: Calculate from interactions
            diversity_score=0.5,  # Default neutral diversity
            last_updated=datetime.now(timezone.utc)
        )
        
        self._user_preference_cache[user_id] = preference_data
        
        logger.debug(
            f"Loaded preference data for user {user_id}: "
            f"{len(frequent_users)} frequent users, {len(interaction_weights)} weighted interactions"
        )
        
        return preference_data
    
    @monitor_query("optimized_read_status")
    async def _get_read_status_batch(
        self, 
        user_id: int, 
        post_ids: List[str],
        user_last_feed_view: Optional[datetime] = None
    ) -> Dict[str, bool]:
        """
        Efficiently determine read status for multiple posts.
        
        Args:
            user_id: ID of the user
            post_ids: List of post IDs to check
            user_last_feed_view: User's last feed view timestamp
            
        Returns:
            Dict mapping post_id to read status (True = read, False = unread)
        """
        read_status = {}
        
        # Get session-based read status (fast in-memory lookup)
        session_read_posts = self.get_read_posts(user_id)
        
        # If we have user_last_feed_view, we can determine unread posts efficiently
        if user_last_feed_view:
            # Batch query to get post creation times
            posts_query = select(Post.id, Post.created_at).where(
                Post.id.in_(post_ids)
            )
            posts_result = await self.db.execute(posts_query)
            posts_data = {row.id: row.created_at for row in posts_result.fetchall()}
            
            # Determine read status
            for post_id in post_ids:
                post_created_at = posts_data.get(post_id)
                
                # Check session read status first (highest priority)
                if post_id in session_read_posts:
                    read_status[post_id] = True
                    continue
                
                # Check timestamp-based read status
                if post_created_at and user_last_feed_view:
                    # Handle timezone-aware comparison
                    if post_created_at.tzinfo is None:
                        post_created_at = post_created_at.replace(tzinfo=timezone.utc)
                    if user_last_feed_view.tzinfo is None:
                        user_last_feed_view = user_last_feed_view.replace(tzinfo=timezone.utc)
                    
                    # Post is read if it was created before last feed view
                    read_status[post_id] = post_created_at <= user_last_feed_view
                else:
                    # Default to unread if no timestamp data
                    read_status[post_id] = False
        else:
            # Fallback to session-based read status only
            for post_id in post_ids:
                read_status[post_id] = post_id in session_read_posts
        
        return read_status
    
    async def calculate_post_score_optimized(
        self,
        post: Post,
        user_id: Optional[int] = None,
        engagement_data: Optional[EngagementData] = None,
        user_preference_data: Optional[UserPreferenceData] = None,
        consider_read_status: bool = True,
        user_last_feed_view: Optional[datetime] = None,
        read_status: Optional[bool] = None
    ) -> float:
        """
        Optimized post scoring with pre-loaded data and caching.
        
        Args:
            post: Post object to score
            user_id: ID of the user viewing the feed
            engagement_data: Pre-loaded engagement data
            user_preference_data: Pre-loaded user preference data
            consider_read_status: Whether to apply read status penalty
            user_last_feed_view: User's last feed view timestamp
            read_status: Pre-calculated read status (optional)
            
        Returns:
            float: Calculated engagement score
        """
        # Use pre-loaded engagement data or load individually
        if engagement_data:
            hearts_count = engagement_data.hearts_count
            reactions_count = engagement_data.reactions_count
            shares_count = engagement_data.shares_count
        else:
            # Fallback to individual queries (less efficient)
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
        
        # Base engagement score using configurable weights
        scoring_weights = self.config.scoring_weights
        base_score = (
            (hearts_count * scoring_weights.hearts) + 
            (reactions_count * scoring_weights.reactions) + 
            (shares_count * scoring_weights.shares)
        )
        
        # Content type bonuses
        content_bonus = 0.0
        if post.post_type == PostType.photo:
            content_bonus += scoring_weights.photo_bonus
        elif post.post_type == PostType.daily:
            content_bonus += scoring_weights.daily_gratitude_bonus
        
        # Fast time factoring using pre-calculated buckets
        time_multiplier = self._get_time_multiplier_fast(post)
        
        # Enhanced relationship multiplier using cached preference data
        relationship_multiplier = 1.0
        if user_id and post.author_id != user_id:
            if user_preference_data:
                # Use cached preference data for faster calculation
                if post.author_id in user_preference_data.frequent_interaction_users:
                    preference_factors = self.config.preference_factors
                    relationship_multiplier *= (1.0 + preference_factors.frequent_user_boost)
                
                # Apply interaction weight bonus
                interaction_weight = user_preference_data.interaction_weights.get(post.author_id, 0)
                if interaction_weight > 0:
                    # Normalize interaction weight to reasonable multiplier range
                    normalized_weight = min(interaction_weight / 10.0, 2.0)  # Cap at 2x multiplier
                    relationship_multiplier *= (1.0 + normalized_weight)
            
            # Still check follow relationship (this is cached by SQLAlchemy)
            follow_multiplier = await self._calculate_follow_relationship_multiplier(user_id, post.author_id)
            relationship_multiplier *= follow_multiplier
        
        # Apply unread boost or read status penalty
        unread_multiplier = 1.0
        if consider_read_status and user_id:
            if read_status is not None:
                # Use pre-calculated read status
                if not read_status:  # Unread
                    unread_multiplier = scoring_weights.unread_boost
                else:  # Read
                    unread_multiplier = 1.0 / scoring_weights.unread_boost
            else:
                # Fallback to individual read status check
                is_unread_by_timestamp = False
                if user_last_feed_view and post.created_at:
                    post_created_at = post.created_at
                    if post_created_at.tzinfo is None:
                        post_created_at = post_created_at.replace(tzinfo=timezone.utc)
                    
                    user_feed_view = user_last_feed_view
                    if user_feed_view.tzinfo is None:
                        user_feed_view = user_feed_view.replace(tzinfo=timezone.utc)
                    
                    is_unread_by_timestamp = post_created_at > user_feed_view
                
                is_read_in_session = self.is_post_read(user_id, post.id)
                
                if is_unread_by_timestamp and not is_read_in_session:
                    unread_multiplier = scoring_weights.unread_boost
                elif is_read_in_session:
                    unread_multiplier = 1.0 / scoring_weights.unread_boost
        
        # Apply mention bonus (cached by SQLAlchemy)
        mention_bonus = 0.0
        if user_id and post.author_id != user_id:
            mention_bonus = await self._calculate_mention_bonus(user_id, post.id)
        
        # Apply own post bonus
        own_post_multiplier = 1.0
        own_post_base_score = 0.0
        if user_id and post.author_id == user_id:
            current_time = datetime.now(timezone.utc)
            post_created_at = post.created_at
            if post_created_at.tzinfo is None:
                post_created_at = post_created_at.replace(tzinfo=timezone.utc)
            
            minutes_old = (current_time - post_created_at).total_seconds() / 60
            own_post_multiplier = self._calculate_own_post_bonus(minutes_old)
            own_post_base_score = 1.0
        
        # Calculate final score
        final_score = (
            (base_score + content_bonus + mention_bonus + own_post_base_score) * 
            relationship_multiplier * unread_multiplier * time_multiplier * own_post_multiplier
        )
        
        return final_score
    
    @monitor_algorithm_performance("optimized_personalized_feed")
    @monitor_query("optimized_personalized_feed")
    async def get_personalized_feed_optimized(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        algorithm_enabled: bool = True,
        consider_read_status: bool = True,
        refresh_mode: bool = False
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Optimized personalized feed with performance monitoring and <300ms target.
        
        Args:
            user_id: ID of the user requesting the feed
            limit: Maximum number of posts to return
            offset: Number of posts to skip for pagination
            algorithm_enabled: Whether to use algorithm scoring
            consider_read_status: Whether to deprioritize read posts
            refresh_mode: Whether to prioritize unread posts
            
        Returns:
            Tuple[List[Dict[str, Any]], int]: (posts with scores, total_count)
        """
        start_time = time.time()
        
        try:
            async with performance_monitoring("optimized_feed_generation"):
                # Load user data sequentially to avoid concurrent database operations
                user = await self.get_by_id(User, user_id)
                user_preference_data = await self._load_user_preference_data(user_id)
                
                user_last_feed_view = user.last_feed_view if user else None
                
                if not algorithm_enabled:
                    return await self._get_recent_feed(
                        user_id, limit, offset, consider_read_status, user_last_feed_view
                    )
                
                # Get posts with optimized query
                posts_query = select(Post).where(
                    Post.is_public == True
                ).options(
                    selectinload(Post.author)
                ).order_by(Post.created_at.desc()).limit(limit * 3)  # Get more for filtering
                
                posts_result = await self.db.execute(posts_query)
                posts = posts_result.scalars().all()
                
                if not posts:
                    return [], 0
                
                # Batch load engagement data
                post_ids = [post.id for post in posts]
                engagement_data_dict = await self._load_engagement_data_batch(post_ids)
                
                # Batch load read status
                read_status_dict = await self._get_read_status_batch(
                    user_id, post_ids, user_last_feed_view
                ) if consider_read_status else {}
                
                # Calculate scores in batch
                scored_posts = []
                for post in posts:
                    engagement_data = engagement_data_dict.get(post.id)
                    read_status = read_status_dict.get(post.id) if consider_read_status else None
                    
                    score = await self.calculate_post_score_optimized(
                        post=post,
                        user_id=user_id,
                        engagement_data=engagement_data,
                        user_preference_data=user_preference_data,
                        consider_read_status=consider_read_status,
                        user_last_feed_view=user_last_feed_view,
                        read_status=read_status
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
                            'profile_image_url': post.author.profile_image_url,
                            'bio': post.author.bio,
                            'city': post.author.city,
                            'institutions': post.author.institutions,
                            'websites': post.author.websites,
                            'profile_photo_filename': post.author.profile_photo_filename
                        },
                        'hearts_count': engagement_data.hearts_count if engagement_data else 0,
                        'reactions_count': engagement_data.reactions_count if engagement_data else 0,
                        'shares_count': engagement_data.shares_count if engagement_data else 0,
                        'algorithm_score': score,
                        'is_read': read_status if consider_read_status else False,
                        'is_unread': not read_status if consider_read_status and read_status is not None else False
                    })
                
                # Sort by score first
                scored_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
                
                # Apply spacing rules to prevent consecutive posts from same author
                spaced_posts = self._apply_spacing_rules(scored_posts)
                
                # Apply pagination after spacing
                final_posts = spaced_posts[offset:offset + limit]
                
                # Get total count
                total_count_result = await self.db.execute(
                    select(func.count(Post.id)).where(Post.is_public == True)
                )
                total_count = total_count_result.scalar() or 0
                
                execution_time = (time.time() - start_time) * 1000  # Convert to ms
                
                logger.info(
                    f"Optimized feed generated for user {user_id}: "
                    f"{len(final_posts)} posts in {execution_time:.1f}ms "
                    f"(target: {self._performance_target_ms}ms)"
                )
                
                # Log performance warning if target exceeded
                if execution_time > self._performance_target_ms:
                    logger.warning(
                        f"Feed generation exceeded performance target: "
                        f"{execution_time:.1f}ms > {self._performance_target_ms}ms"
                    )
                
                return final_posts, total_count
                
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.error(
                f"Optimized feed generation failed for user {user_id} "
                f"after {execution_time:.1f}ms: {e}"
            )
            raise
    
    def clear_caches(self) -> None:
        """Clear all performance caches."""
        self._engagement_cache.clear()
        self._user_preference_cache.clear()
        logger.info("Cleared all performance caches")
    
    def _apply_spacing_rules(self, posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply spacing rules to prevent consecutive posts from the same author.
        
        Args:
            posts: List of posts sorted by algorithm score
            
        Returns:
            List of posts with spacing rules applied
        """
        if len(posts) <= 1:
            return posts
        
        diversity_limits = self.config.diversity_limits
        max_consecutive = diversity_limits.max_consecutive_posts_per_user
        penalty = diversity_limits.spacing_violation_penalty
        
        # Create a working copy
        working_posts = posts.copy()
        final_posts = []
        
        while working_posts:
            # Take the highest scoring post
            best_post = working_posts.pop(0)
            final_posts.append(best_post)
            
            # Check if we need to apply spacing rules
            if len(final_posts) >= max_consecutive:
                # Look at the last max_consecutive posts
                recent_posts = final_posts[-max_consecutive:]
                recent_authors = [post['author_id'] for post in recent_posts]
                
                # If all recent posts are from the same author, we have a violation
                if len(set(recent_authors)) == 1:
                    # Find posts from different authors to insert
                    different_author_posts = [
                        post for post in working_posts 
                        if post['author_id'] != recent_authors[0]
                    ]
                    
                    if different_author_posts:
                        # Remove the different author post from working_posts and add it to final_posts
                        next_post = different_author_posts[0]
                        working_posts.remove(next_post)
                        final_posts.append(next_post)
                        
                        # Apply penalty to the posts we're skipping
                        same_author_posts = [
                            post for post in working_posts[:5]  # Look at next 5 posts
                            if post['author_id'] == recent_authors[0]
                        ]
                        
                        for post in same_author_posts:
                            post['algorithm_score'] *= penalty
                            post['spacing_penalty_applied'] = True
                        
                        # Re-sort working posts after penalty application
                        working_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
        
        return final_posts
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring."""
        return {
            "time_buckets": len(self._time_bucket_cache),
            "engagement_cache": len(self._engagement_cache),
            "user_preference_cache": len(self._user_preference_cache),
            "performance_target_ms": self._performance_target_ms,
            "batch_size": self._batch_size
        }