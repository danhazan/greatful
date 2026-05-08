"""
Post repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_, or_
from app.core.repository_base import BaseRepository
from app.core.storage import storage  # ← ADDED: Import storage adapter
from app.models.post import Post
from app.models.user import User


class PostRepository(BaseRepository):
    """Repository for Post model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Post)
    
    @staticmethod
    def _is_public_condition():
        """Strict public visibility condition."""
        return Post.privacy_level == "public"

    def _apply_visibility(self, query, viewer_id: Optional[int]):
        """Apply shared post-visibility abstraction to a query."""
        from app.services.post_privacy_service import PostPrivacyService

        return query.where(PostPrivacyService.visibility_filter_clause(viewer_id, self.db))

    def visible_posts_query(self, viewer_id: Optional[int]):
        """
        Canonical base query for viewer-visible posts.

        Contract:
        - All viewer-visible post queries MUST originate from this method.
        - Visibility filtering is applied first; callers may then add extra filters
          (e.g. author_id), followed by ordering and pagination.
        """
        return self._apply_visibility(select(Post), viewer_id)

    async def get_by_author(
        self, 
        author_id: int, 
        public_only: bool = False,
        limit: int = 20,
        offset: int = 0
    ) -> List[Post]:
        """
        Get posts by author with optional public filter.
        
        Args:
            author_id: ID of the author
            public_only: Whether to only return public posts
            limit: Maximum number of posts
            offset: Number of posts to skip
            
        Returns:
            List[Post]: List of posts by the author
        """
        builder = self.query().filter(Post.author_id == author_id)
        
        if public_only:
            builder = builder.filter(self._is_public_condition())
        
        builder = builder.order_by(desc(Post.created_at)).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get posts by author")
        return result.scalars().all()
    
    async def get_public_feed(
        self, 
        limit: int = 20, 
        offset: int = 0,
    ) -> List[Post]:
        """
        Get public posts for feed.

        Args:
            limit: Maximum number of posts
            offset: Number of posts to skip

        Returns:
            List[Post]: List of public posts
        """
        builder = self.query().filter(self._is_public_condition())
        builder = builder.order_by(desc(Post.created_at)).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get public feed")
        return result.scalars().all()
    
    async def get_posts_with_engagement(
        self,
        viewer_id: int,
        author_id: Optional[int] = None,
        include_privacy_details: bool = False,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get posts with engagement data (hearts, reactions) for a specific user.
        
        Args:
            viewer_id: ID of the viewer (for visibility + personalized data)
            author_id: Optional author ID to filter by
            limit: Maximum number of posts
            offset: Number of posts to skip
            
        Returns:
            List[Dict]: List of posts with engagement data and full URLs
        """
        import logging
        logger = logging.getLogger(__name__)

        # Enforce visibility at SQL level
        visible_ids_query = self._apply_visibility(select(Post.id), viewer_id)
        if author_id is not None:
            visible_ids_query = visible_ids_query.where(Post.author_id == author_id)
        visible_ids_query = visible_ids_query.order_by(desc(Post.created_at)).limit(limit).offset(offset)

        try:
            visible_ids_result = await self._execute_query(visible_ids_query, "get visible timeline post ids")
            selected_post_ids = list(visible_ids_result.scalars().all())
            if not selected_post_ids:
                return []

            return await self._fetch_engagement_data(selected_post_ids, viewer_id, include_privacy_details)
        except Exception as e:
            logger.error(f"Error in get_posts_with_engagement: {e}")
            raise
    async def get_single_post_with_engagement(
        self,
        post_id: str,
        viewer_id: Optional[int] = None,
        include_privacy_details: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Get a single post with engagement data and privacy details.
        Enforces visibility at the SQL level (Security: No existence leaks).
        """
        # Enforce visibility - returns ID ONLY if viewer is authorized
        visible_id_query = self._apply_visibility(select(Post.id), viewer_id).where(Post.id == post_id)
        
        try:
            result = await self._execute_query(visible_id_query, "get single visible post id")
            found_id = result.scalar_one_or_none()
            
            if not found_id:
                return None
                
            posts = await self._fetch_engagement_data([found_id], viewer_id, include_privacy_details)
            return posts[0] if posts else None
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in get_single_post_with_engagement: {e}")
            raise

    async def _fetch_engagement_data(
        self,
        selected_post_ids: List[str],
        viewer_id: Optional[int],
        include_privacy_details: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Internal shared logic to fetch and map engagement data for a batch of post IDs.
        Contract: Bit-for-bit compatible structure across list and single-item views.
        """
        import json
        import logging
        from app.services.post_privacy_service import PostPrivacyService
        
        logger = logging.getLogger(__name__)
        from app.models.emoji_reaction import EmojiReaction
        # Create reverse mapping for legacy emoji characters to slugs
        EMOJI_TO_SLUG = {v: k for k, v in EmojiReaction.VALID_EMOJIS.items()}
        
        dialect = self.db.bind.dialect.name if self.db.bind is not None else ""

        def build_in_clause_params(values: List[str], prefix: str) -> tuple[str, Dict[str, str]]:
            placeholders = ", ".join(f":{prefix}_{i}" for i in range(len(values)))
            params = {f"{prefix}_{i}": values[i] for i in range(len(values))}
            return placeholders, params

        post_id_placeholders, post_id_params = build_in_clause_params(selected_post_ids, "post_id")
        
        # Dialect-specific aggregation
        is_postgresql = dialect == "postgresql"
        # Deterministic ordering for aggregated emojis: emoji_code ASC
        reaction_agg_expression = (
            "ARRAY_AGG(DISTINCT emoji_code ORDER BY emoji_code)"
            if is_postgresql
            else "GROUP_CONCAT(DISTINCT emoji_code)"
        )
        reaction_default_expression = "ARRAY[]::text[]" if is_postgresql else "''"

        query = text(f"""
            SELECT p.id,
                   p.author_id,
                   p.content,
                   p.rich_content,
                   p.post_style,
                   p.image_url,
                   p.location,
                   p.location_data,
                   p.is_public,
                   p.privacy_level,
                   p.created_at,
                   p.updated_at,
                   u.id as author_user_id,
                   u.username as author_username,
                   u.display_name as author_display_name,
                   u.email as author_email,
                   u.profile_image_url as author_profile_image_url,
                   COALESCE(engagement.reactions_count, 0) as reactions_count,
                   COALESCE(engagement.reaction_emoji_codes, {reaction_default_expression}) as reaction_emoji_codes,
                   COALESCE(comments.comments_count, 0) as comments_count,
                   user_reactions.emoji_code as current_user_reaction
            FROM posts p
            LEFT JOIN users u ON u.id = p.author_id
            LEFT JOIN (
                SELECT post_id,
                       COUNT(DISTINCT user_id) as reactions_count,
                       {reaction_agg_expression} as reaction_emoji_codes
                FROM emoji_reactions
                WHERE post_id IN ({post_id_placeholders}) AND object_type = 'post'
                GROUP BY post_id
            ) engagement ON engagement.post_id = p.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as comments_count
                FROM comments
                WHERE post_id IN ({post_id_placeholders})
                GROUP BY post_id
            ) comments ON comments.post_id = p.id
            LEFT JOIN (
                SELECT post_id, user_id, MAX(emoji_code) as emoji_code
                FROM emoji_reactions
                WHERE post_id IN ({post_id_placeholders}) 
                    AND user_id = :viewer_id
                    AND object_type = 'post'
                GROUP BY post_id, user_id
            ) user_reactions ON user_reactions.post_id = p.id
            WHERE p.id IN ({post_id_placeholders})
        """)

        params = {**post_id_params, "viewer_id": viewer_id}
        result = await self.execute_raw_query(query, params)
        rows = result.fetchall()
        
        posts = []
        collected_ids = []
        for row in rows:
            # Normalize location_data safely
            loc_data = row.location_data
            if isinstance(loc_data, str):
                try: loc_data = json.loads(loc_data)
                except: loc_data = None

            # Normalize post_style safely
            post_style_data = row.post_style
            if isinstance(post_style_data, str):
                try: post_style_data = json.loads(post_style_data)
                except: post_style_data = None

            # Full URL conversions
            author_profile_image_url = storage.get_url(row.author_profile_image_url) if row.author_profile_image_url else None
            image_url = storage.get_url(row.image_url) if row.image_url else None

            post_dict = {
                "id": row.id,
                "author_id": row.author_id,
                "content": row.content,
                "rich_content": getattr(row, "rich_content", None),
                "post_style": post_style_data,
                "image_url": image_url,
                "images": [],
                "location": row.location,
                "location_data": loc_data,
                "is_public": row.is_public,
                "privacy_level": row.privacy_level if getattr(row, "privacy_level", None) else "public",
                "created_at": str(row.created_at),
                "updated_at": str(row.updated_at) if row.updated_at else None,
                "author": {
                    "id": str(row.author_user_id),
                    "username": row.author_username,
                    "display_name": row.author_display_name,
                    "name": row.author_display_name or row.author_username or "Unknown",
                    "image": author_profile_image_url,
                    "follower_count": 0,
                    "following_count": 0,
                    "posts_count": 0,
                    "is_following": None
                },
                "reactions_count": int(row.reactions_count) if row.reactions_count else 0,
                "comments_count": int(row.comments_count) if row.comments_count else 0,
                "comments": [],
                "current_user_reaction": EMOJI_TO_SLUG.get(row.current_user_reaction, row.current_user_reaction),
                "reaction_emoji_codes": (
                    [code for code in (getattr(row, "reaction_emoji_codes", "") or "").split(",") if code]
                    if isinstance(getattr(row, "reaction_emoji_codes", None), str)
                    else list(getattr(row, "reaction_emoji_codes", None) or [])
                ),
                "emoji_counts": {},
            }
            posts.append(post_dict)
            collected_ids.append(row.id)

        # Batch load Author stats and Follow statuses for bit-for-bit parity
        unique_author_ids = list({post['author_id'] for post in posts if post['author_id']})
        if unique_author_ids:
            from app.repositories.user_repository import UserRepository
            from app.repositories.follow_repository import FollowRepository
            user_repo = UserRepository(self.db)
            follow_repo = FollowRepository(self.db)
            
            author_stats = await user_repo.get_user_stats_batch(unique_author_ids)
            follow_statuses = await follow_repo.bulk_check_following_status(viewer_id, unique_author_ids) if viewer_id else {}
            
            for post in posts:
                aid = post['author_id']
                if aid in author_stats:
                    stats = author_stats[aid]
                    post['author'].update({
                        "follower_count": stats.get("followers_count", 0),
                        "following_count": stats.get("following_count", 0),
                        "posts_count": stats.get("posts_count", 0),
                    })
                if aid in follow_statuses and viewer_id and viewer_id != aid:
                    post['author']["is_following"] = follow_statuses[aid]

        # Batch load images
        if collected_ids:
            post_image_placeholders, post_image_params = build_in_clause_params(collected_ids, "image_post_id")
            images_query = text(f"""
                SELECT id, post_id, position, thumbnail_url, medium_url, original_url, width, height
                FROM post_images
                WHERE post_id IN ({post_image_placeholders})
                ORDER BY post_id, position ASC
            """)
            images_result = await self.execute_raw_query(images_query, post_image_params)
            images_rows = images_result.fetchall()

            images_by_post: Dict[str, List[Dict[str, Any]]] = {}
            for img_row in images_rows:
                if img_row.post_id not in images_by_post:
                    images_by_post[img_row.post_id] = []
                
                images_by_post[img_row.post_id].append({
                    "id": img_row.id,
                    "position": img_row.position,
                    "thumbnail_url": storage.get_url(img_row.thumbnail_url) if img_row.thumbnail_url else None,
                    "medium_url": storage.get_url(img_row.medium_url) if img_row.medium_url else None,
                    "original_url": storage.get_url(img_row.original_url) if img_row.original_url else None,
                    "width": img_row.width,
                    "height": img_row.height
                })

            for post in posts:
                post["images"] = images_by_post.get(post["id"], [])

        # Batch load privacy details
        if include_privacy_details and collected_ids:
            privacy_service = PostPrivacyService(self.db)
            privacy_details_by_post = await privacy_service.get_privacy_details_for_posts(collected_ids)
            for post in posts:
                details = privacy_details_by_post.get(post["id"], {})
                post["privacy_rules"] = details.get("privacy_rules", [])
                post["specific_users"] = details.get("specific_users", [])

        # Preserve input order by mapping results back to selected_post_ids sequence
        posts_by_id = {p["id"]: p for p in posts}
        ordered_posts = [posts_by_id[pid] for pid in selected_post_ids if pid in posts_by_id]

        return ordered_posts

    async def search_posts(
        self, 
        query: str, 
        limit: int = 20,
        offset: int = 0
    ) -> List[Post]:
        """
        Search posts by content.
        
        Args:
            query: Search query string
            limit: Maximum number of posts
            offset: Number of posts to skip
            
        Returns:
            List[Post]: List of matching posts
        """
        builder = self.query().filter(
            and_(
                self._is_public_condition(),
                Post.content.ilike(f"%{query}%")
            )
        ).order_by(desc(Post.created_at)).limit(limit).offset(offset)
        
        query_obj = builder.build()
        result = await self._execute_query(query_obj, "search posts")
        return result.scalars().all()
    
    async def get_post_stats(self, post_id: str) -> Dict[str, Any]:
        """
        Get comprehensive post statistics.
        
        Args:
            post_id: ID of the post
            
        Returns:
            Dict containing post statistics
        """
        
        query = text("""
                SELECT 
                    p.id,
                    COUNT(DISTINCT er.id) as reactions_count,
                    COUNT(DISTINCT er.emoji_code) as unique_emoji_count
                FROM posts p
                LEFT JOIN emoji_reactions er ON er.post_id = p.id
                WHERE p.id = :post_id
                GROUP BY p.id
            """)
        
        result = await self.execute_raw_query(query, {"post_id": post_id})
        row = result.fetchone()
        
        if not row:
            return {
                "reactions_count": 0,
                "unique_emoji_count": 0
            }
        
        return {
            "reactions_count": int(row.reactions_count) if row.reactions_count else 0,
            "unique_emoji_count": int(row.unique_emoji_count) if row.unique_emoji_count else 0
        }
    
    async def get_trending_posts(
        self, 
        limit: int = 20,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get trending posts based on recent engagement.
        
        Args:
            limit: Maximum number of posts
            hours: Number of hours to look back for trending calculation
            
        Returns:
            List[Dict]: List of trending posts with engagement scores and full URLs
        """
        query = text("""
            SELECT 
                p.id,
                p.content,
                p.image_url,
                p.created_at,
                u.username as author_username,
                COUNT(DISTINCT CASE WHEN er.emoji_code = 'heart' THEN er.id END) as recent_heart_reactions,
                COUNT(DISTINCT er.id) as recent_reactions,
                (COUNT(DISTINCT er.id) * 1.5) as engagement_score
            FROM posts p
            LEFT JOIN users u ON u.id = p.author_id
            LEFT JOIN emoji_reactions er ON er.post_id = p.id 
                AND er.created_at >= NOW() - INTERVAL :hours HOUR
            WHERE p.privacy_level = 'public'
                AND p.created_at >= NOW() - INTERVAL :hours HOUR
            GROUP BY p.id, p.content, p.image_url, p.created_at, u.username
            HAVING (COUNT(DISTINCT er.id) * 1.5) > 0
            ORDER BY engagement_score DESC, p.created_at DESC
            LIMIT :limit
        """)
        
        result = await self.execute_raw_query(query, {"hours": hours, "limit": limit})
        rows = result.fetchall()
        
        trending_posts = []
        for row in rows:
            # ✅ FIXED: Convert image_url to full URL
            image_url = None
            if row.image_url:
                image_url = storage.get_url(row.image_url)
            
            trending_posts.append({
                "id": row.id,
                "content": row.content,
                "image_url": image_url,  # ← Full URL now!
                "created_at": str(row.created_at),
                "author_username": row.author_username,
                "recent_heart_reactions": int(row.recent_heart_reactions) if row.recent_heart_reactions else 0,
                "recent_reaction_count": int(row.recent_reactions) if row.recent_reactions else 0,
                "engagement_score": float(row.engagement_score) if row.engagement_score else 0.0
            })
        
        return trending_posts
    

    async def serialize_posts_for_feed(
        self,
        posts: List[Post],
        user_id: int,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Standardized post serialization for feed and timeline.
        Now routes through the unified engagement pipeline.
        """
        if not posts:
            return []
        
        post_ids = [p.id for p in posts]
        # Safely handle viewer_id (guest vs authenticated)
        viewer_id = user_id if user_id and user_id > 0 else None
        
        return await self._fetch_engagement_data(post_ids, viewer_id)
