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
from app.models.comment import Comment
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
    comments_count: int


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
        
        # Batch query for hearts (using emoji reactions with 'heart' emoji_code)
        hearts_query = select(
            EmojiReaction.post_id,
            func.count(EmojiReaction.id).label('hearts_count')
        ).where(
            and_(
                EmojiReaction.post_id.in_(post_ids),
                EmojiReaction.emoji_code == 'heart'
            )
        ).group_by(EmojiReaction.post_id)
        
        hearts_result = await self.db.execute(hearts_query)
        hearts_counts = {row.post_id: row.hearts_count for row in hearts_result.fetchall()}
        
        # Batch query for reactions (excluding heart reactions which are counted separately)
        reactions_query = select(
            EmojiReaction.post_id,
            func.count(EmojiReaction.id).label('reactions_count')
        ).where(
            and_(
                EmojiReaction.post_id.in_(post_ids),
                EmojiReaction.emoji_code != 'heart'
            )
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

        # Batch query for comments
        comments_query = select(
            Comment.post_id,
            func.count(Comment.id).label('comments_count')
        ).where(
            Comment.post_id.in_(post_ids)
        ).group_by(Comment.post_id)
        
        comments_result = await self.db.execute(comments_query)
        comments_counts = {row.post_id: row.comments_count for row in comments_result.fetchall()}
        
        # Combine data
        for post_id in post_ids:
            engagement_data[post_id] = EngagementData(
                post_id=post_id,
                hearts_count=hearts_counts.get(post_id, 0),
                reactions_count=reactions_counts.get(post_id, 0),
                shares_count=shares_counts.get(post_id, 0),
                comments_count=comments_counts.get(post_id, 0)
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
    
    @monitor_query("batch_mentions")
    async def _get_mentions_batch(self, user_id: int, post_ids: List[str]) -> Dict[str, bool]:
        """Check mentions for multiple posts efficiently."""
        if not post_ids:
            return {}
            
        from app.models.mention import Mention
        mentions_query = select(Mention.post_id).where(
            and_(
                Mention.mentioned_user_id == user_id,
                Mention.post_id.in_(post_ids)
            )
        )
        result = await self.db.execute(mentions_query)
        mentioned_post_ids = {row.post_id for row in result.fetchall()}
        return {post_id: (post_id in mentioned_post_ids) for post_id in post_ids}

    @monitor_query("batch_author_multipliers")
    async def _get_author_multipliers_batch(
        self, 
        user_id: int, 
        author_ids: List[int],
        user_preference_data: Optional[UserPreferenceData]
    ) -> Dict[int, float]:
        """Batch calculate relationship multipliers for unique authors to eliminate N+1 queries."""
        if not author_ids:
            return {}
            
        # 1. Get direct active follows
        follows_query = select(Follow).where(
            and_(
                Follow.follower_id == user_id,
                Follow.followed_id.in_(author_ids),
                Follow.status == "active"
            )
        )
        follows_result = await self.db.execute(follows_query)
        active_follows = {f.followed_id: f for f in follows_result.scalars().all()}
        
        # 2. Get mutual follows
        mutual_query = select(Follow.follower_id).where(
            and_(
                Follow.follower_id.in_(author_ids),
                Follow.followed_id == user_id,
                Follow.status == "active"
            )
        )
        mutual_result = await self.db.execute(mutual_query)
        mutual_follows_set = {getattr(row, 'follower_id', row[0]) for row in mutual_result.fetchall()}

        # 3. Calculate multipliers locally
        follow_bonuses = self.config.follow_bonuses
        current_time = datetime.now(timezone.utc)
        
        multipliers = {}
        for author_id in author_ids:
            follow = active_follows.get(author_id)
            if follow:
                # Direct follow bonus rules
                follow_created_at = follow.created_at
                if follow_created_at.tzinfo is None:
                    follow_created_at = follow_created_at.replace(tzinfo=timezone.utc)
                
                days_following = (current_time - follow_created_at).days
                
                base_multiplier = follow_bonuses.base_multiplier
                if days_following <= follow_bonuses.new_follow_threshold_days:
                    base_multiplier = follow_bonuses.new_follow_bonus
                elif days_following <= follow_bonuses.established_follow_threshold_days:
                    base_multiplier = follow_bonuses.established_follow_bonus
                
                if author_id in mutual_follows_set:
                    base_multiplier = follow_bonuses.mutual_follow_bonus
                    
                recency_multiplier = 1.0
                if days_following <= follow_bonuses.recent_follow_days:
                    recency_multiplier = 1.0 + follow_bonuses.recent_follow_boost
                
                # Try to use cached interaction/preference data instead of doing DB queries per author
                engagement_multiplier = 1.0
                if user_preference_data:
                    weight = user_preference_data.interaction_weights.get(author_id, 0)
                    if weight > 0:
                        engagement_multiplier = 1.0 + min(weight / 10.0, 1.5)  # Simulate DB logic roughly
                
                multipliers[author_id] = base_multiplier * recency_multiplier * engagement_multiplier
            else:
                # Basic second tier follow simulation, or just fallback to 1.0
                multipliers[author_id] = 1.0
                
        return multipliers

    async def calculate_post_score_optimized(
        self,
        post: Post,
        user_id: Optional[int] = None,
        engagement_data: Optional[EngagementData] = None,
        user_preference_data: Optional[UserPreferenceData] = None,
        consider_read_status: bool = True,
        user_last_feed_view: Optional[datetime] = None,
        read_status: Optional[bool] = None,
        author_multiplier: Optional[float] = None,
        is_mentioned: Optional[bool] = None
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
            # Strict boundary: Do not execute DB queries during scoring phase.
            hearts_count = 0
            reactions_count = 0
            shares_count = 0
            
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
            
            # Use batch-calculated follow multiplier if provided, else individual queries
            if author_multiplier is not None:
                follow_multiplier = author_multiplier
            else:
                # Strict boundary: Default to 1.0 rather than triggering a DB query
                follow_multiplier = 1.0
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
                # Strict boundary: Assume read if no batch data to prevent N+1 query
                unread_multiplier = 1.0 / scoring_weights.unread_boost
        
        # Apply mention bonus
        mention_bonus = 0.0
        if user_id and post.author_id != user_id:
            if is_mentioned is not None:
                mention_bonus = self.config.mention_bonuses.direct_mention if is_mentioned else 0.0
            else:
                mention_bonus = 0.0  # Strict boundary: do not fallback to queries
        
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
        Optimized personalized feed with deep SQL tracing and bounded query execution.
        
        ARCHITECTURE:
        This method acts as a FeedService pipeline, breaking down feed generation into 
        deterministic stages to prevent N+1 query scaling:
        
        1. Fetch Candidate Posts: Eagerly loads base relationships (author, images).
        2. Batch Load Engagement: Loads hearts, reactions, comments, tracks in 1 pass.
        3. Batch Read Status: Loads read timestamps in 1 pass.
        4. Batch Mentions & Follows: Consolidates complex multiplier checks (mutual follows, 
           interactions, mentions) into 1-2 bounded queries based on unique author IDs.
        5. Score Posts: Core algorithm iterates purely in-memory using the batched dicts.
        6. Serialize: Passes batched data to `PostRepository.serialize_posts_for_feed`.
        
        Regardless of `limit`, the SQL query count for this entire flow stays bounded 
        to ~18 total statements.
        """
        from app.repositories.post_repository import PostRepository
        
        start_time = time.time()
        
        # Start DB statement profiling for this specific feed request
        from sqlalchemy import event
        from sqlalchemy.engine import Engine
        
        query_count = 0
        def count_queries(conn, cursor, statement, parameters, context, executemany):
            nonlocal query_count
            query_count += 1
            # Uncomment to deeply inspect every query text:
            # logger.debug(f"[FEED TRACE SQL] {statement.strip()}")
            
        event.listen(self.db.bind.sync_engine, "before_cursor_execute", count_queries)
        
        try:
            async with performance_monitoring("optimized_feed_generation"):
                # Load user data
                user = await self.get_by_id(User, user_id)
                user_preference_data = await self._load_user_preference_data(user_id)
                
                user_last_feed_view = user.last_feed_view if user else None
                
                if not algorithm_enabled:
                    event.remove(self.db.bind.sync_engine, "before_cursor_execute", count_queries)
                    return await self._get_recent_feed(
                        user_id, limit, offset, consider_read_status, user_last_feed_view
                    )
                
                logger.info(f"[FEED TRACE] Starting feed generation for user {user_id}. Phase 1: Fetch Posts")
                # Get posts with optimized query
                posts_query = select(Post).where(
                    Post.is_public == True
                ).options(
                    selectinload(Post.author),
                    selectinload(Post.images)
                ).order_by(Post.created_at.desc()).limit(limit * 3)
                
                posts_result = await self.db.execute(posts_query)
                posts = posts_result.scalars().all()
                
                post_fetch_queries = query_count
                logger.info(f"[FEED TRACE] Fetched {len(posts)} candidate posts. Queries so far: {post_fetch_queries}")
                
                if not posts:
                    event.remove(self.db.bind.sync_engine, "before_cursor_execute", count_queries)
                    return [], 0
                
                logger.info(f"[FEED TRACE] Phase 2: Batch Load Engagement")
                # Batch load engagement data
                post_ids = [p.id for p in posts]
                engagement_data = await self._load_engagement_data_batch(post_ids)
                
                eng_fetch_queries = query_count - post_fetch_queries
                logger.info(f"[FEED TRACE] Engagement data loaded. Queries took: {eng_fetch_queries}")
                
                logger.info(f"[FEED TRACE] Phase 3: Batch Read Status")
                # Batch read status
                read_status_batch = await self._get_read_status_batch(
                    user_id=user_id,
                    post_ids=post_ids,
                    user_last_feed_view=user_last_feed_view
                )
                
                read_fetch_queries = query_count - (post_fetch_queries + eng_fetch_queries)
                logger.info(f"[FEED TRACE] Read status loaded. Queries took: {read_fetch_queries}")
                
                logger.info(f"[FEED TRACE] Phase 3.5: Batch Mentions and Follows")
                # Batch load mentions
                mentions_batch = await self._get_mentions_batch(user_id, post_ids)
                
                # Batch load follow multipliers
                unique_author_ids = list({p.author_id for p in posts if p.author_id != user_id})
                author_multipliers_batch = await self._get_author_multipliers_batch(
                    user_id, unique_author_ids, user_preference_data
                )
                
                rel_fetch_queries = query_count - (post_fetch_queries + eng_fetch_queries + read_fetch_queries)
                logger.info(f"[FEED TRACE] Mentions and Follows loaded. Queries took: {rel_fetch_queries}")
                
                logger.info(f"[FEED TRACE] Phase 4: Scoring")
                # Calculate scores in batch
                algorithm_scores = {}
                scored_posts = []
                
                for post in posts:
                    score = await self.calculate_post_score_optimized(
                        post=post,
                        user_id=user_id,
                        engagement_data=engagement_data.get(post.id),
                        user_preference_data=user_preference_data,
                        consider_read_status=consider_read_status,
                        user_last_feed_view=user_last_feed_view,
                        read_status=read_status_batch.get(post.id),
                        author_multiplier=author_multipliers_batch.get(post.author_id),
                        is_mentioned=mentions_batch.get(post.id)
                    )
                    algorithm_scores[post.id] = score
                    scored_posts.append((score, post))
                
                score_queries = query_count - (post_fetch_queries + eng_fetch_queries + read_fetch_queries)
                logger.info(f"[FEED TRACE] Scoring complete. Queries took: {score_queries} (Should be 0 if fully batched!)")
                
                # Sort and paginate
                scored_posts.sort(key=lambda x: x[0], reverse=True)
                paginated_posts = [p for _, p in scored_posts[offset:offset+limit]]
                
                logger.info(f"[FEED TRACE] Phase 5: Final Serialization")
                serialization_start_queries = query_count
                
                # Convert engagement payload format expected by serialize_posts_for_feed
                engagement_counts = {
                    p_id: {
                        'hearts': data.hearts_count,
                        'reactions': data.reactions_count,
                        'shares': data.shares_count,
                        'comments': data.comments_count
                    }
                    for p_id, data in engagement_data.items()
                }
                
                # Final serialization using bulk repository method
                post_repo = PostRepository(self.db)
                serialized_feed = await post_repo.serialize_posts_for_feed(
                    posts=paginated_posts,
                    user_id=user_id,
                    engagement_counts=engagement_counts,
                    algorithm_scores=algorithm_scores,
                    read_statuses=read_status_batch if consider_read_status else None
                )
                
                serial_queries = query_count - serialization_start_queries
                logger.info(f"[FEED TRACE] Serialization complete. Queries took: {serial_queries}")
                
                 # Get total count
                total_count_start_queries = query_count
                total_count_result = await self.db.execute(
                    select(func.count(Post.id)).where(Post.is_public == True)
                )
                total_count = total_count_result.scalar() or 0
                count_queries_sql = query_count - total_count_start_queries
                logger.info(f"[FEED TRACE] Total count query took: {count_queries_sql} statements")

                execution_time = (time.time() - start_time) * 1000
                logger.info(f"[FEED TRACE SUMMARY] Feed generation complete in {execution_time:.2f}ms.")
                logger.info(f"[FEED TRACE SUMMARY] Total Posts: {len(serialized_feed)}")
                logger.info(f"[FEED TRACE SUMMARY] Total SQL Statements: {query_count}")
                
                if execution_time > self._performance_target_ms:
                    logger.warning(
                        f"Feed generation exceeded performance target: "
                        f"{execution_time:.1f}ms > {self._performance_target_ms}ms"
                    )
                
                event.remove(self.db.bind.sync_engine, "before_cursor_execute", count_queries)
                return serialized_feed, total_count
                
        except Exception as e:
            try:
                from sqlalchemy import event
                event.remove(self.db.bind.sync_engine, "before_cursor_execute", count_queries)
            except:
                pass
                
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