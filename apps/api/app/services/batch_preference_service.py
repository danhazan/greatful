"""
Batch Preference Learning Service

This service handles batch processing for user preference learning and diversity
calculations to optimize algorithm performance and maintain <300ms feed loading.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta, timezone
from collections import defaultdict, Counter
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_, text
from sqlalchemy.orm import selectinload

from app.core.service_base import BaseService
from app.models.user_interaction import UserInteraction
from app.models.follow import Follow
from app.models.user import User
from app.models.post import Post, PostType
from app.config.algorithm_config import get_algorithm_config
from app.core.algorithm_performance import (
    monitor_algorithm_performance,
    algorithm_cache_manager
)

logger = logging.getLogger(__name__)


@dataclass
class UserPreferenceProfile:
    """User preference profile for personalized ranking."""
    user_id: int
    frequent_interaction_users: Set[int]
    interaction_weights: Dict[int, float]
    content_type_preferences: Dict[str, float]
    time_preferences: Dict[str, float]
    diversity_score: float
    last_updated: datetime


@dataclass
class BatchProcessingResult:
    """Result of batch preference processing."""
    processed_users: int
    updated_profiles: int
    processing_time_ms: float
    cache_hits: int
    cache_misses: int


class BatchPreferenceService(BaseService):
    """
    Service for batch processing user preferences and diversity calculations.
    
    Optimizes preference learning by processing multiple users in batches,
    reducing database queries and improving overall algorithm performance.
    """
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.config = get_algorithm_config()
        self.batch_size = 50  # Process users in batches of 50
        self.preference_cache_ttl = 1800  # 30 minutes
    
    @monitor_algorithm_performance("batch_user_preferences")
    async def process_user_preferences_batch(
        self, 
        user_ids: List[int],
        force_refresh: bool = False
    ) -> Dict[int, UserPreferenceProfile]:
        """
        Process user preferences in batch for multiple users.
        
        Args:
            user_ids: List of user IDs to process
            force_refresh: Whether to force refresh cached data
            
        Returns:
            Dict mapping user_id to UserPreferenceProfile
        """
        if not user_ids:
            return {}
        
        preference_profiles = {}
        users_to_process = []
        
        # Check cache first (unless force refresh)
        if not force_refresh:
            for user_id in user_ids:
                cached_profile = algorithm_cache_manager.get("user_preferences", str(user_id))
                if cached_profile:
                    preference_profiles[user_id] = cached_profile
                else:
                    users_to_process.append(user_id)
        else:
            users_to_process = user_ids
        
        if not users_to_process:
            logger.debug(f"All {len(user_ids)} user preferences loaded from cache")
            return preference_profiles
        
        # Process users in batches
        for i in range(0, len(users_to_process), self.batch_size):
            batch_user_ids = users_to_process[i:i + self.batch_size]
            batch_profiles = await self._process_preference_batch(batch_user_ids)
            
            # Cache the results
            for user_id, profile in batch_profiles.items():
                algorithm_cache_manager.set("user_preferences", str(user_id), profile)
                preference_profiles[user_id] = profile
        
        logger.debug(
            f"Processed preferences for {len(users_to_process)} users, "
            f"{len(user_ids) - len(users_to_process)} from cache"
        )
        
        return preference_profiles
    
    async def _process_preference_batch(self, user_ids: List[int]) -> Dict[int, UserPreferenceProfile]:
        """Process a batch of users for preference learning."""
        preference_factors = self.config.preference_factors
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=preference_factors.preference_decay_days)
        
        # Batch query for all user interactions
        interactions_query = select(
            UserInteraction.user_id,
            UserInteraction.target_user_id,
            UserInteraction.interaction_type,
            UserInteraction.post_id,
            func.count(UserInteraction.id).label('interaction_count'),
            func.sum(UserInteraction.weight).label('total_weight')
        ).where(
            and_(
                UserInteraction.user_id.in_(user_ids),
                UserInteraction.created_at >= thirty_days_ago
            )
        ).group_by(
            UserInteraction.user_id,
            UserInteraction.target_user_id,
            UserInteraction.interaction_type,
            UserInteraction.post_id
        )
        
        interactions_result = await self.db.execute(interactions_query)
        interactions = interactions_result.fetchall()
        
        # Batch query for post types (for content preferences)
        post_ids = [interaction.post_id for interaction in interactions if interaction.post_id]
        post_types = {}
        if post_ids:
            posts_query = select(Post.id, Post.post_type).where(Post.id.in_(post_ids))
            posts_result = await self.db.execute(posts_query)
            post_types = {row.id: row.post_type for row in posts_result.fetchall()}
        
        # Process interactions by user
        user_interactions = defaultdict(list)
        for interaction in interactions:
            user_interactions[interaction.user_id].append(interaction)
        
        # Build preference profiles
        preference_profiles = {}
        for user_id in user_ids:
            profile = await self._build_user_preference_profile(
                user_id, 
                user_interactions.get(user_id, []),
                post_types
            )
            preference_profiles[user_id] = profile
        
        return preference_profiles
    
    async def _build_user_preference_profile(
        self,
        user_id: int,
        interactions: List[Any],
        post_types: Dict[str, PostType]
    ) -> UserPreferenceProfile:
        """Build preference profile for a single user."""
        preference_factors = self.config.preference_factors
        
        # Calculate interaction weights
        interaction_weights = defaultdict(float)
        user_interaction_counts = defaultdict(int)
        content_type_interactions = defaultdict(int)
        time_interactions = defaultdict(int)
        
        for interaction in interactions:
            target_user_id = interaction.target_user_id
            interaction_type = interaction.interaction_type
            count = interaction.interaction_count
            total_weight = interaction.total_weight or count
            
            # Apply type-specific weights
            type_weight = self._get_interaction_type_weight(interaction_type)
            weighted_score = total_weight * type_weight
            
            interaction_weights[target_user_id] += weighted_score
            user_interaction_counts[target_user_id] += count
            
            # Track content type preferences
            if interaction.post_id and interaction.post_id in post_types:
                post_type = post_types[interaction.post_id].value
                content_type_interactions[post_type] += count
            
            # Track time-based interaction patterns (simplified)
            # This could be enhanced with actual interaction timestamps
            time_interactions['recent'] += count
        
        # Identify frequent users
        frequent_users = {
            uid for uid, count in user_interaction_counts.items()
            if count >= preference_factors.interaction_threshold
        }
        
        # Calculate content type preferences (normalized)
        total_content_interactions = sum(content_type_interactions.values())
        content_preferences = {}
        if total_content_interactions > 0:
            for content_type, count in content_type_interactions.items():
                content_preferences[content_type] = count / total_content_interactions
        
        # Calculate time preferences (simplified)
        total_time_interactions = sum(time_interactions.values())
        time_preferences = {}
        if total_time_interactions > 0:
            for time_period, count in time_interactions.items():
                time_preferences[time_period] = count / total_time_interactions
        
        # Calculate diversity score (based on interaction spread)
        diversity_score = self._calculate_diversity_score(interaction_weights)
        
        return UserPreferenceProfile(
            user_id=user_id,
            frequent_interaction_users=frequent_users,
            interaction_weights=dict(interaction_weights),
            content_type_preferences=content_preferences,
            time_preferences=time_preferences,
            diversity_score=diversity_score,
            last_updated=datetime.now(timezone.utc)
        )
    
    def _get_interaction_type_weight(self, interaction_type: str) -> float:
        """Get weight for interaction type."""
        preference_factors = self.config.preference_factors
        
        weights = {
            'heart': preference_factors.heart_interaction_weight,
            'reaction': preference_factors.reaction_interaction_weight,
            'share': preference_factors.share_interaction_weight,
            'mention': preference_factors.mention_interaction_weight,
            'follow': 2.0  # Follow is a strong signal
        }
        
        return weights.get(interaction_type, 1.0)
    
    def _calculate_diversity_score(self, interaction_weights: Dict[int, float]) -> float:
        """
        Calculate diversity score based on interaction distribution.
        
        Higher score means more diverse interactions (good for discovery).
        Lower score means concentrated interactions (good for personalization).
        """
        if not interaction_weights:
            return 0.5  # Neutral diversity
        
        weights = list(interaction_weights.values())
        total_weight = sum(weights)
        
        if total_weight == 0:
            return 0.5
        
        # Calculate entropy-like measure using proper entropy formula
        normalized_weights = [w / total_weight for w in weights]
        import math
        diversity = -sum(w * math.log2(w) for w in normalized_weights if w > 0)
        
        # Normalize to 0-1 range (max entropy is log2(n) where n is number of users)
        max_diversity = math.log2(len(weights)) if len(weights) > 1 else 1
        return min(diversity / max_diversity, 1.0) if max_diversity > 0 else 0.5
    
    @monitor_algorithm_performance("batch_diversity_calculation")
    async def calculate_feed_diversity_batch(
        self,
        posts: List[Dict[str, Any]],
        user_preference_profile: Optional[UserPreferenceProfile] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculate and apply diversity constraints to a batch of posts.
        
        Args:
            posts: List of post dictionaries with scores
            user_preference_profile: User's preference profile for personalization
            
        Returns:
            List of posts with diversity adjustments applied
        """
        if not posts:
            return posts
        
        diversity_limits = self.config.diversity_limits
        
        # Group posts by author
        posts_by_author = defaultdict(list)
        for post in posts:
            posts_by_author[post['author_id']].append(post)
        
        # Apply author diversity limits
        diversified_posts = []
        author_post_counts = defaultdict(int)
        
        # Sort posts by score first
        sorted_posts = sorted(posts, key=lambda x: x.get('algorithm_score', 0), reverse=True)
        
        for post in sorted_posts:
            author_id = post['author_id']
            
            # Check author limit
            if author_post_counts[author_id] >= diversity_limits.max_posts_per_author:
                # Apply diversity penalty
                post['algorithm_score'] *= diversity_limits.spacing_violation_penalty
                post['diversity_penalty'] = True
            else:
                author_post_counts[author_id] += 1
                post['diversity_penalty'] = False
            
            diversified_posts.append(post)
        
        # Apply content type diversity
        diversified_posts = self._apply_content_type_diversity(
            diversified_posts, user_preference_profile
        )
        
        # Apply spacing rules
        diversified_posts = self._apply_spacing_rules(diversified_posts)
        
        # Re-sort posts after applying all diversity penalties
        diversified_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
        
        return diversified_posts
    
    def _apply_content_type_diversity(
        self,
        posts: List[Dict[str, Any]],
        user_preference_profile: Optional[UserPreferenceProfile] = None
    ) -> List[Dict[str, Any]]:
        """Apply content type diversity limits."""
        diversity_limits = self.config.diversity_limits
        
        # Count posts by type
        type_counts = Counter(post.get('post_type', 'spontaneous') for post in posts)
        total_posts = len(posts)
        
        # Calculate limits
        max_photo = int(total_posts * diversity_limits.max_photo_posts_percentage)
        max_daily = int(total_posts * diversity_limits.max_daily_posts_percentage)
        max_spontaneous = int(total_posts * diversity_limits.max_spontaneous_posts_percentage)
        
        # Apply penalties for exceeding limits
        current_counts = defaultdict(int)
        
        for post in posts:
            post_type = post.get('post_type', 'spontaneous')
            current_counts[post_type] += 1
            
            # Check if this post type is over limit
            over_limit = False
            if post_type == 'photo' and current_counts[post_type] > max_photo:
                over_limit = True
            elif post_type == 'daily' and current_counts[post_type] > max_daily:
                over_limit = True
            elif post_type == 'spontaneous' and current_counts[post_type] > max_spontaneous:
                over_limit = True
            
            if over_limit:
                post['algorithm_score'] *= 0.7  # Reduce score for over-limit content
                post['content_type_penalty'] = True
            else:
                post['content_type_penalty'] = False
            
            # Apply user preference boost if available
            if user_preference_profile and user_preference_profile.content_type_preferences:
                preference_boost = user_preference_profile.content_type_preferences.get(post_type, 0.5)
                post['algorithm_score'] *= (1.0 + preference_boost * 0.5)  # Up to 50% boost
        
        return posts
    
    def _apply_spacing_rules(self, posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply spacing rules to prevent consecutive posts from same author."""
        diversity_limits = self.config.diversity_limits
        window_size = diversity_limits.spacing_window_size
        max_consecutive = diversity_limits.max_consecutive_posts_per_user
        
        logger.debug(f"Applying spacing rules: max_consecutive={max_consecutive}, window_size={window_size}")
        
        if len(posts) <= window_size:
            return posts
        
        penalties_applied = 0
        
        # Check for spacing violations in sliding windows
        for i in range(len(posts) - window_size + 1):
            window_posts = posts[i:i + window_size]
            author_counts = Counter(post['author_id'] for post in window_posts)
            
            # Apply penalty for authors with too many posts in window
            for author_id, count in author_counts.items():
                if count > max_consecutive:
                    logger.debug(f"Found spacing violation: author {author_id} has {count} posts in window (max: {max_consecutive})")
                    # Find posts by this author in the window and apply penalty
                    for post in window_posts:
                        if post['author_id'] == author_id:
                            old_score = post['algorithm_score']
                            post['algorithm_score'] *= diversity_limits.spacing_violation_penalty
                            post['spacing_penalty'] = True
                            penalties_applied += 1
                            logger.debug(f"Applied spacing penalty to post {post.get('id', 'unknown')}: {old_score:.2f} -> {post['algorithm_score']:.2f}")
        
        logger.debug(f"Applied spacing penalties to {penalties_applied} posts")
        return posts
    
    @monitor_algorithm_performance("batch_follow_relationships")
    async def load_follow_relationships_batch(
        self, 
        user_ids: List[int]
    ) -> Dict[int, Dict[str, Set[int]]]:
        """
        Load follow relationships for multiple users in batch.
        
        Args:
            user_ids: List of user IDs to load relationships for
            
        Returns:
            Dict mapping user_id to {'following': set, 'followers': set}
        """
        if not user_ids:
            return {}
        
        # Check cache first
        cached_relationships = {}
        users_to_process = []
        
        for user_id in user_ids:
            cached_data = algorithm_cache_manager.get("follow_relationships", str(user_id))
            if cached_data:
                cached_relationships[user_id] = cached_data
            else:
                users_to_process.append(user_id)
        
        if not users_to_process:
            return cached_relationships
        
        # Batch query for follow relationships
        follows_query = select(
            Follow.follower_id,
            Follow.followed_id,
            Follow.status
        ).where(
            and_(
                or_(
                    Follow.follower_id.in_(users_to_process),
                    Follow.followed_id.in_(users_to_process)
                ),
                Follow.status == "active"
            )
        )
        
        follows_result = await self.db.execute(follows_query)
        follows = follows_result.fetchall()
        
        # Process relationships
        relationships = {}
        for user_id in users_to_process:
            relationships[user_id] = {
                'following': set(),
                'followers': set()
            }
        
        for follow in follows:
            follower_id = follow.follower_id
            followed_id = follow.followed_id
            
            if follower_id in relationships:
                relationships[follower_id]['following'].add(followed_id)
            
            if followed_id in relationships:
                relationships[followed_id]['followers'].add(follower_id)
        
        # Cache the results
        for user_id, data in relationships.items():
            algorithm_cache_manager.set("follow_relationships", str(user_id), data)
        
        # Combine with cached data
        all_relationships = {**cached_relationships, **relationships}
        
        logger.debug(
            f"Loaded follow relationships for {len(users_to_process)} users, "
            f"{len(cached_relationships)} from cache"
        )
        
        return all_relationships
    
    async def invalidate_user_cache(self, user_id: int) -> None:
        """Invalidate all cached data for a user."""
        algorithm_cache_manager.invalidate("user_preferences", str(user_id))
        algorithm_cache_manager.invalidate("follow_relationships", str(user_id))
        logger.debug(f"Invalidated cache for user {user_id}")
    
    async def get_batch_processing_stats(self) -> Dict[str, Any]:
        """Get statistics about batch processing performance."""
        cache_stats = algorithm_cache_manager.get_cache_stats()
        
        return {
            "batch_size": self.batch_size,
            "preference_cache_ttl": self.preference_cache_ttl,
            "cache_statistics": cache_stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }