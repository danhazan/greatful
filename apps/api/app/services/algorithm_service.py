"""
Algorithm service for calculating post engagement scores and feed ranking.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
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

logger = logging.getLogger(__name__)


class AlgorithmService(BaseService):
    """
    Service for calculating post engagement scores and generating personalized feeds.
    
    Scoring Formula:
    Base Score = (Hearts × 1.0) + (Reactions × 1.5) + (Shares × 4.0)
    Content Bonuses: Photo posts (+2.5), Daily gratitude posts (+3.0)
    Relationship Multiplier: Posts from followed users (+2.0)
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db)

    async def calculate_post_score(
        self, 
        post: Post, 
        user_id: Optional[int] = None,
        hearts_count: Optional[int] = None,
        reactions_count: Optional[int] = None,
        shares_count: Optional[int] = None
    ) -> float:
        """
        Calculate engagement score for a post.
        
        Args:
            post: Post object to score
            user_id: ID of the user viewing the feed (for relationship multiplier)
            hearts_count: Pre-calculated hearts count (optional, will query if not provided)
            reactions_count: Pre-calculated reactions count (optional, will query if not provided)
            shares_count: Pre-calculated shares count (optional, will query if not provided)
            
        Returns:
            float: Calculated engagement score
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

        # Base engagement score
        base_score = (hearts_count * 1.0) + (reactions_count * 1.5) + (shares_count * 4.0)
        
        # Content type bonuses
        content_bonus = 0.0
        if post.post_type == PostType.photo:
            content_bonus += 2.5
        elif post.post_type == PostType.daily:
            content_bonus += 3.0
        
        # Relationship multiplier
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
                relationship_multiplier = 2.0

        # Calculate final score
        final_score = (base_score + content_bonus) * relationship_multiplier
        
        logger.debug(
            f"Post {post.id} score calculation: "
            f"base={base_score:.2f} (hearts={hearts_count}, reactions={reactions_count}, shares={shares_count}), "
            f"content_bonus={content_bonus:.2f}, relationship_multiplier={relationship_multiplier:.2f}, "
            f"final={final_score:.2f}"
        )
        
        return final_score

    async def get_personalized_feed(
        self, 
        user_id: int, 
        limit: int = 20, 
        offset: int = 0,
        algorithm_enabled: bool = True
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get personalized feed with algorithm-based ranking.
        
        Args:
            user_id: ID of the user requesting the feed
            limit: Maximum number of posts to return
            offset: Number of posts to skip for pagination
            algorithm_enabled: Whether to use algorithm scoring (80/20 split) or just recency
            
        Returns:
            Tuple[List[Dict[str, Any]], int]: (posts with scores, total_count)
        """
        if not algorithm_enabled:
            # Fallback to simple recency-based feed
            return await self._get_recent_feed(user_id, limit, offset)

        # Calculate 80/20 split
        algorithm_limit = int(limit * 0.8)
        recent_limit = limit - algorithm_limit

        # Get algorithm-scored posts (80%)
        algorithm_posts = await self._get_algorithm_scored_posts(
            user_id, algorithm_limit, offset
        )

        # Get recent posts (20%) - exclude posts already in algorithm results
        algorithm_post_ids = {post['id'] for post in algorithm_posts}
        recent_posts = await self._get_recent_posts_excluding(
            user_id, recent_limit, 0, algorithm_post_ids
        )

        # Combine and return
        combined_posts = algorithm_posts + recent_posts
        
        # Get total count for pagination
        total_count_result = await self.db.execute(
            select(func.count(Post.id)).where(Post.is_public == True)
        )
        total_count = total_count_result.scalar() or 0

        logger.info(
            f"Generated personalized feed for user {user_id}: "
            f"{len(algorithm_posts)} algorithm posts, {len(recent_posts)} recent posts, "
            f"total available: {total_count}"
        )

        return combined_posts[:limit], total_count

    async def _get_algorithm_scored_posts(
        self, 
        user_id: int, 
        limit: int, 
        offset: int
    ) -> List[Dict[str, Any]]:
        """Get posts ranked by algorithm score."""
        # Query posts with engagement counts
        from sqlalchemy.orm import outerjoin
        
        query = select(
            Post,
            func.count(Like.id).label('hearts_count'),
            func.count(EmojiReaction.id).label('reactions_count'),
            func.count(Share.id).label('shares_count')
        ).select_from(
            outerjoin(
                outerjoin(
                    outerjoin(Post, Like, Post.id == Like.post_id),
                    EmojiReaction, Post.id == EmojiReaction.post_id
                ),
                Share, Post.id == Share.post_id
            )
        ).where(
            Post.is_public == True
        ).group_by(Post.id).options(
            selectinload(Post.author)
        )

        result = await self.db.execute(query)
        posts_data = result.all()

        # Calculate scores for each post
        scored_posts = []
        for row in posts_data:
            post = row.Post
            hearts_count = row.hearts_count or 0
            reactions_count = row.reactions_count or 0
            shares_count = row.shares_count or 0

            score = await self.calculate_post_score(
                post, user_id, hearts_count, reactions_count, shares_count
            )

            scored_posts.append({
                'id': post.id,
                'author_id': post.author_id,
                'title': post.title,
                'content': post.content,
                'post_type': post.post_type.value,
                'image_url': post.image_url,
                'location': post.location,
                'is_public': post.is_public,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'email': post.author.email,
                    'profile_image_url': post.author.profile_image_url
                } if post.author else None,
                'hearts_count': hearts_count,
                'reactions_count': reactions_count,
                'shares_count': shares_count,
                'algorithm_score': score
            })

        # Sort by score (descending) and apply pagination
        scored_posts.sort(key=lambda x: x['algorithm_score'], reverse=True)
        return scored_posts[offset:offset + limit]

    async def _get_recent_posts_excluding(
        self, 
        user_id: int, 
        limit: int, 
        offset: int, 
        exclude_ids: set
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
                'title': post.title,
                'content': post.content,
                'post_type': post.post_type.value,
                'image_url': post.image_url,
                'location': post.location,
                'is_public': post.is_public,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'email': post.author.email,
                    'profile_image_url': post.author.profile_image_url
                } if post.author else None,
                'hearts_count': hearts_count,
                'reactions_count': reactions_count,
                'shares_count': shares_count,
                'algorithm_score': 0.0  # Recent posts don't get algorithm scoring
            })

        return recent_posts

    async def _get_recent_feed(
        self, 
        user_id: int, 
        limit: int, 
        offset: int
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get simple recency-based feed (fallback when algorithm is disabled)."""
        recent_posts = await self._get_recent_posts_excluding(user_id, limit, offset, set())
        
        # Get total count
        total_count_result = await self.db.execute(
            select(func.count(Post.id)).where(Post.is_public == True)
        )
        total_count = total_count_result.scalar() or 0

        return recent_posts, total_count

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
        from datetime import datetime, timedelta
        
        cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        
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

            # Calculate trending score (higher weight for recent engagement)
            base_engagement = (hearts_count * 2.0) + (reactions_count * 3.0) + (shares_count * 8.0)
            
            # Only include posts with actual engagement
            if base_engagement > 0:
                # Add recency bonus (newer posts get higher scores)
                hours_old = (datetime.utcnow() - post.created_at).total_seconds() / 3600
                recency_bonus = max(0, (time_window_hours - hours_old) / time_window_hours * 5.0)
                trending_score = base_engagement + recency_bonus
                trending_posts.append({
                    'id': post.id,
                    'author_id': post.author_id,
                    'title': post.title,
                    'content': post.content,
                    'post_type': post.post_type.value,
                    'image_url': post.image_url,
                    'location': post.location,
                    'is_public': post.is_public,
                    'created_at': post.created_at.isoformat() if post.created_at else None,
                    'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                    'author': {
                        'id': post.author.id,
                        'username': post.author.username,
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