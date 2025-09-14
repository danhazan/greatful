"""
User preference service for tracking interactions and building preference profiles.
"""

import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, desc, or_
from sqlalchemy.orm import selectinload

from app.core.service_base import BaseService
from app.core.exceptions import ValidationException, NotFoundError
from app.models.user_interaction import UserInteraction
from app.models.user import User
from app.models.post import Post
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.mention import Mention
from app.config.algorithm_config import get_preference_factors

logger = logging.getLogger(__name__)


class UserPreferenceService(BaseService):
    """
    Service for tracking user interactions and building preference profiles.
    
    This service tracks various types of interactions between users to build
    preference profiles for personalized feed ranking and diversity control.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.preference_config = get_preference_factors()

    async def track_interaction(
        self,
        user_id: int,
        target_user_id: int,
        interaction_type: str,
        post_id: Optional[str] = None,
        weight_override: Optional[float] = None
    ) -> UserInteraction:
        """
        Track a user interaction for preference learning.
        
        Args:
            user_id: ID of the user performing the interaction
            target_user_id: ID of the user being interacted with
            interaction_type: Type of interaction ('heart', 'reaction', 'share', 'mention', 'follow')
            post_id: ID of the related post (if applicable)
            weight_override: Custom weight for the interaction (optional)
            
        Returns:
            UserInteraction: The created interaction record
            
        Raises:
            ValidationException: If interaction parameters are invalid
        """
        # Validate interaction type
        valid_types = ['heart', 'reaction', 'share', 'mention', 'follow']
        if interaction_type not in valid_types:
            raise ValidationException(
                f"Invalid interaction type: {interaction_type}",
                {"interaction_type": f"Must be one of: {', '.join(valid_types)}"}
            )
        
        # Prevent self-interactions
        if user_id == target_user_id:
            logger.debug(f"Skipping self-interaction for user {user_id}")
            return None
        
        # Calculate interaction weight based on type
        if weight_override is not None:
            weight = weight_override
        else:
            weight = self._calculate_interaction_weight(interaction_type)
        
        # Check if interaction already exists (for deduplication)
        existing_query = select(UserInteraction).where(
            and_(
                UserInteraction.user_id == user_id,
                UserInteraction.target_user_id == target_user_id,
                UserInteraction.interaction_type == interaction_type,
                UserInteraction.post_id == post_id if post_id else UserInteraction.post_id.is_(None)
            )
        )
        
        existing_interaction = await self.db.execute(existing_query)
        existing = existing_interaction.scalar_one_or_none()
        
        if existing:
            # Update existing interaction timestamp and weight
            existing.weight = max(existing.weight, weight)  # Keep highest weight
            existing.updated_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.debug(f"Updated existing interaction: {existing.id}")
            return existing
        
        # Create new interaction
        interaction_data = {
            "user_id": user_id,
            "target_user_id": target_user_id,
            "interaction_type": interaction_type,
            "post_id": post_id,
            "weight": weight
        }
        
        interaction = await self.create_entity(UserInteraction, **interaction_data)
        
        logger.debug(
            f"Tracked interaction: user {user_id} -> user {target_user_id} "
            f"({interaction_type}, weight={weight:.2f})"
        )
        
        return interaction

    def _calculate_interaction_weight(self, interaction_type: str) -> float:
        """
        Calculate the weight for an interaction based on its type.
        
        Args:
            interaction_type: Type of interaction
            
        Returns:
            float: Weight value for the interaction
        """
        weight_mapping = {
            'heart': self.preference_config.heart_interaction_weight,
            'reaction': self.preference_config.reaction_interaction_weight,
            'share': self.preference_config.share_interaction_weight,
            'mention': self.preference_config.mention_interaction_weight,
            'follow': 3.0  # Follow is a strong signal
        }
        
        return weight_mapping.get(interaction_type, 1.0)

    async def get_user_preferences(
        self,
        user_id: int,
        limit: int = 50,
        days_back: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get user preference profile based on interaction history.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of preferred users to return
            days_back: Number of days to look back (default: preference_decay_days)
            
        Returns:
            List[Dict[str, Any]]: List of preferred users with interaction scores
        """
        if days_back is None:
            days_back = self.preference_config.preference_decay_days
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
        
        # Aggregate interactions by target user
        query = select(
            UserInteraction.target_user_id,
            func.sum(UserInteraction.weight).label('total_weight'),
            func.count(UserInteraction.id).label('interaction_count'),
            func.max(UserInteraction.updated_at).label('last_interaction')
        ).where(
            and_(
                UserInteraction.user_id == user_id,
                UserInteraction.created_at >= cutoff_date
            )
        ).group_by(
            UserInteraction.target_user_id
        ).having(
            func.sum(UserInteraction.weight) >= self.preference_config.interaction_threshold
        ).order_by(
            desc('total_weight')
        ).limit(limit)
        
        result = await self.db.execute(query)
        preferences = result.fetchall()
        
        # Convert to list of dictionaries with user information
        preference_list = []
        for pref in preferences:
            # Get user information
            user = await self.get_by_id(User, pref.target_user_id)
            if user:
                preference_list.append({
                    'user_id': pref.target_user_id,
                    'username': user.username,
                    'display_name': user.display_name,
                    'total_weight': float(pref.total_weight),
                    'interaction_count': pref.interaction_count,
                    'last_interaction': pref.last_interaction.isoformat() if pref.last_interaction else None,
                    'preference_score': self._calculate_preference_score(
                        float(pref.total_weight),
                        pref.interaction_count,
                        pref.last_interaction
                    )
                })
        
        logger.debug(f"Found {len(preference_list)} preferred users for user {user_id}")
        return preference_list

    def _calculate_preference_score(
        self,
        total_weight: float,
        interaction_count: int,
        last_interaction: datetime
    ) -> float:
        """
        Calculate a preference score based on interaction data.
        
        Args:
            total_weight: Total interaction weight
            interaction_count: Number of interactions
            last_interaction: Timestamp of last interaction
            
        Returns:
            float: Preference score (higher = stronger preference)
        """
        # Base score from total weight
        base_score = total_weight
        
        # Frequency bonus (more interactions = stronger signal)
        frequency_bonus = min(interaction_count * 0.1, 2.0)  # Cap at 2.0
        
        # Recency factor (recent interactions are more relevant)
        if last_interaction:
            days_since = (datetime.now(timezone.utc) - last_interaction).days
            recency_factor = max(0.1, 1.0 - (days_since / self.preference_config.preference_decay_days))
        else:
            recency_factor = 0.1
        
        preference_score = (base_score + frequency_bonus) * recency_factor
        
        return preference_score

    async def get_frequent_interaction_users(self, user_id: int) -> List[int]:
        """
        Get list of user IDs that the user frequently interacts with.
        
        Args:
            user_id: ID of the user
            
        Returns:
            List[int]: List of user IDs for frequent interactions
        """
        preferences = await self.get_user_preferences(user_id, limit=20)
        
        # Filter users above the frequent interaction threshold
        frequent_users = [
            pref['user_id'] for pref in preferences
            if pref['preference_score'] >= self.preference_config.frequent_user_boost
        ]
        
        logger.debug(f"Found {len(frequent_users)} frequent interaction users for user {user_id}")
        return frequent_users

    async def calculate_preference_boost(self, user_id: int, post_author_id: int) -> float:
        """
        Calculate preference boost for a post based on user's interaction history.
        
        Args:
            user_id: ID of the user viewing the feed
            post_author_id: ID of the post author
            
        Returns:
            float: Preference boost multiplier (1.0 = no boost, >1.0 = boost)
        """
        if user_id == post_author_id:
            return 1.0  # No preference boost for own posts
        
        # Get user preferences
        preferences = await self.get_user_preferences(user_id, limit=50)
        
        # Find preference for this author
        author_preference = next(
            (pref for pref in preferences if pref['user_id'] == post_author_id),
            None
        )
        
        if not author_preference:
            return 1.0  # No interaction history
        
        # Calculate boost based on preference score
        preference_score = author_preference['preference_score']
        
        if preference_score >= self.preference_config.interaction_threshold:
            # Apply configurable boost for frequent interactions
            boost = self.preference_config.frequent_user_boost
            logger.debug(
                f"Applied preference boost {boost:.2f} for user {post_author_id} "
                f"(score: {preference_score:.2f})"
            )
            return boost
        
        return 1.0

    async def cleanup_old_interactions(self, days_to_keep: int = 90) -> int:
        """
        Clean up old interaction records to prevent database bloat.
        
        Args:
            days_to_keep: Number of days of interactions to keep
            
        Returns:
            int: Number of interactions deleted
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
        
        # Delete old interactions
        delete_query = select(UserInteraction).where(
            UserInteraction.created_at < cutoff_date
        )
        
        old_interactions = await self.db.execute(delete_query)
        interactions_to_delete = old_interactions.scalars().all()
        
        count = len(interactions_to_delete)
        
        for interaction in interactions_to_delete:
            await self.db.delete(interaction)
        
        await self.db.commit()
        
        logger.info(f"Cleaned up {count} old interaction records older than {days_to_keep} days")
        return count

    async def get_interaction_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Get summary of user's interaction patterns for debugging.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict[str, Any]: Summary of interaction patterns
        """
        # Get interaction counts by type
        type_query = select(
            UserInteraction.interaction_type,
            func.count(UserInteraction.id).label('count'),
            func.sum(UserInteraction.weight).label('total_weight')
        ).where(
            UserInteraction.user_id == user_id
        ).group_by(
            UserInteraction.interaction_type
        )
        
        type_result = await self.db.execute(type_query)
        type_stats = {
            row.interaction_type: {
                'count': row.count,
                'total_weight': float(row.total_weight)
            }
            for row in type_result.fetchall()
        }
        
        # Get total interaction count
        total_query = select(func.count(UserInteraction.id)).where(
            UserInteraction.user_id == user_id
        )
        total_result = await self.db.execute(total_query)
        total_interactions = total_result.scalar() or 0
        
        # Get recent interaction count (last 7 days)
        recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        recent_query = select(func.count(UserInteraction.id)).where(
            and_(
                UserInteraction.user_id == user_id,
                UserInteraction.created_at >= recent_cutoff
            )
        )
        recent_result = await self.db.execute(recent_query)
        recent_interactions = recent_result.scalar() or 0
        
        # Get top preferred users
        preferences = await self.get_user_preferences(user_id, limit=5)
        
        return {
            'user_id': user_id,
            'total_interactions': total_interactions,
            'recent_interactions': recent_interactions,
            'interactions_by_type': type_stats,
            'top_preferences': preferences,
            'frequent_users_count': len(await self.get_frequent_interaction_users(user_id))
        }

    # Convenience methods for tracking specific interaction types
    
    async def track_heart_interaction(self, user_id: int, post_author_id: int, post_id: str) -> Optional[UserInteraction]:
        """Track a heart/like interaction."""
        return await self.track_interaction(user_id, post_author_id, 'heart', post_id)
    
    async def track_reaction_interaction(self, user_id: int, post_author_id: int, post_id: str) -> Optional[UserInteraction]:
        """Track an emoji reaction interaction."""
        return await self.track_interaction(user_id, post_author_id, 'reaction', post_id)
    
    async def track_share_interaction(self, user_id: int, post_author_id: int, post_id: str) -> Optional[UserInteraction]:
        """Track a share interaction."""
        return await self.track_interaction(user_id, post_author_id, 'share', post_id)
    
    async def track_mention_interaction(self, user_id: int, mentioned_user_id: int, post_id: str) -> Optional[UserInteraction]:
        """Track a mention interaction."""
        return await self.track_interaction(user_id, mentioned_user_id, 'mention', post_id)
    
    async def track_follow_interaction(self, user_id: int, followed_user_id: int) -> Optional[UserInteraction]:
        """Track a follow interaction."""
        return await self.track_interaction(user_id, followed_user_id, 'follow')