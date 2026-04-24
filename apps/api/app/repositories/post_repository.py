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
        """Public visibility condition with legacy fallback."""
        return or_(
            Post.privacy_level == "public",
            and_(Post.privacy_level.is_(None), Post.is_public.is_(True)),
        )

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
        import json
        import logging
        
        logger = logging.getLogger(__name__)

        dialect = self.db.bind.dialect.name if self.db.bind is not None else ""

        def build_in_clause_params(values: List[str], prefix: str) -> tuple[str, Dict[str, str]]:
            placeholders = ", ".join(f":{prefix}_{i}" for i in range(len(values)))
            params = {f"{prefix}_{i}": values[i] for i in range(len(values))}
            return placeholders, params

        visible_ids_query = self._apply_visibility(select(Post.id), viewer_id)
        if author_id is not None:
            visible_ids_query = visible_ids_query.where(Post.author_id == author_id)
        visible_ids_query = visible_ids_query.order_by(desc(Post.created_at)).limit(limit).offset(offset)

        try:
            visible_ids_result = await self._execute_query(visible_ids_query, "get visible timeline post ids")
            selected_post_ids = list(visible_ids_result.scalars().all())
            if not selected_post_ids:
                return []

            post_id_placeholders, post_id_params = build_in_clause_params(selected_post_ids, "post_id")
            reaction_agg_expression = (
                "ARRAY_AGG(DISTINCT emoji_code ORDER BY emoji_code)"
                if dialect == "postgresql"
                else "GROUP_CONCAT(DISTINCT emoji_code)"
            )
            reaction_default_expression = "ARRAY[]::text[]" if dialect == "postgresql" else "''"

            query = text(f"""
                SELECT p.id,
                       p.author_id,
                       p.content,
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
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :viewer_id
                WHERE p.id IN ({post_id_placeholders})
                ORDER BY p.created_at DESC
            """)


            
            params = {
                **post_id_params,
                "viewer_id": viewer_id,
            }
            
            logger.debug(f"Executing query with params: {params}")
            result = await self.execute_raw_query(query, params)
            rows = result.fetchall()
            
            posts = []
            post_ids = []
            for row in rows:
                # Normalize location_data safely
                loc_data = row.location_data
                if isinstance(loc_data, str):
                    try:
                        loc_data = json.loads(loc_data)
                    except Exception:
                        loc_data = None

                # Normalize post_style safely
                post_style_data = row.post_style
                if isinstance(post_style_data, str):
                    try:
                        post_style_data = json.loads(post_style_data)
                    except Exception:
                        post_style_data = None

                # ✅ FIXED: Convert author profile_image_url to full URL
                author_profile_image_url = None
                if row.author_profile_image_url:
                    author_profile_image_url = storage.get_url(row.author_profile_image_url)

                # ✅ FIXED: Convert legacy image_url to full URL (if present)
                image_url = None
                if row.image_url:
                    image_url = storage.get_url(row.image_url)

                post_dict = {
                    "id": row.id,
                    "author_id": row.author_id,
                    "content": row.content,
                    "post_style": post_style_data,
                    "image_url": image_url,  # ← Full URL now!
                    "images": [],  # Will be populated below with full URLs
                    "location": row.location,
                    "location_data": loc_data,
                    "is_public": row.is_public,
                    "privacy_level": row.privacy_level if getattr(row, "privacy_level", None) else ("public" if row.is_public else "private"),
                    "created_at": str(row.created_at),
                    "updated_at": str(row.updated_at) if row.updated_at else None,
                    "author": {
                        "id": row.author_user_id,
                        "username": row.author_username,
                        "display_name": row.author_display_name,
                        "email": row.author_email,
                        "profile_image_url": author_profile_image_url  # ← Full URL now!
                    },
                    "reactions_count": int(row.reactions_count) if row.reactions_count else 0,
                    "comments_count": int(row.comments_count) if row.comments_count else 0,
                    "current_user_reaction": row.current_user_reaction,
                    "reaction_emoji_codes": (
                        [code for code in (getattr(row, "reaction_emoji_codes", "") or "").split(",") if code]
                        if isinstance(getattr(row, "reaction_emoji_codes", None), str)
                        else list(getattr(row, "reaction_emoji_codes", None) or [])
                    ),
                }
                posts.append(post_dict)
                post_ids.append(row.id)

            privacy_details_by_post: Dict[str, Dict[str, Any]] = {}
            if include_privacy_details and post_ids:
                from app.services.post_privacy_service import PostPrivacyService
                privacy_service = PostPrivacyService(self.db)
                privacy_details_by_post = await privacy_service.get_privacy_details_for_posts(post_ids)

            # Fetch images for all posts in a single query (multi-image support)
            if post_ids:
                post_image_placeholders, post_image_params = build_in_clause_params(post_ids, "image_post_id")
                images_query = text(f"""
                    SELECT id, post_id, position, thumbnail_url, medium_url, original_url, width, height
                    FROM post_images
                    WHERE post_id IN ({post_image_placeholders})
                    ORDER BY post_id, position
                """)
                images_result = await self.execute_raw_query(images_query, post_image_params)
                images_rows = images_result.fetchall()

                # Group images by post_id
                images_by_post: Dict[str, List[Dict[str, Any]]] = {}
                for img_row in images_rows:
                    post_id = img_row.post_id
                    if post_id not in images_by_post:
                        images_by_post[post_id] = []
                    
                    # ✅ FIXED: Convert all image URLs to full URLs
                    thumbnail_url = storage.get_url(img_row.thumbnail_url) if img_row.thumbnail_url else None
                    medium_url = storage.get_url(img_row.medium_url) if img_row.medium_url else None
                    original_url = storage.get_url(img_row.original_url) if img_row.original_url else None
                    
                    images_by_post[post_id].append({
                        "id": img_row.id,
                        "position": img_row.position,
                        "thumbnail_url": thumbnail_url,  # ← Full URL now!
                        "medium_url": medium_url,        # ← Full URL now!
                        "original_url": original_url,    # ← Full URL now!
                        "width": img_row.width,
                        "height": img_row.height
                    })

                # Assign images to their posts
                for post in posts:
                    post["images"] = images_by_post.get(post["id"], [])

            if include_privacy_details:
                for post in posts:
                    details = privacy_details_by_post.get(post["id"], {})
                    post["privacy_rules"] = details.get("privacy_rules", [])
                    post["specific_users"] = details.get("specific_users", [])

            logger.debug(f"post_repo.get_posts_with_engagement - returning {len(posts)} posts")
            return posts
            
        except Exception as e:
            logger.error(f"Error in get_posts_with_engagement: {e}")
            raise
    
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
                Post.is_public == True,
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
            WHERE p.is_public = true
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
        engagement_counts: Optional[Dict[str, Dict[str, int]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Serialize posts for feed with proper URL conversion.
        Reuses existing logic from get_posts_with_engagement but works with Post objects.

        Args:
            posts: List of Post objects to serialize
            user_id: Current user ID
            engagement_counts: Optional pre-calculated engagement data

        Returns:
            List[Dict]: Serialized posts with full URLs
        """
        import json
        import logging
        from sqlalchemy import text
        from app.services.post_privacy_service import PostPrivacyService
        
        logger = logging.getLogger(__name__)
        
        if not posts:
            return []
        
        # Get post IDs and author IDs for batch queries
        post_ids = [post.id for post in posts]
        author_ids = list({post.author_id for post in posts if post.author_id})
        dialect = self.db.bind.dialect.name if self.db.bind is not None else ""
        is_postgresql = dialect == "postgresql"

        def build_in_clause_params(values: List[str], prefix: str) -> tuple[str, Dict[str, str]]:
            placeholders = ", ".join(f":{prefix}_{i}" for i in range(len(values)))
            params = {f"{prefix}_{i}": values[i] for i in range(len(values))}
            return placeholders, params
        
        # 1. Batch get Author profile stats (1 optimized SQL query)
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(self.db)
        author_stats = await user_repo.get_user_stats_batch(author_ids)
        
        # 2. Batch get Follow statuses (1 optimized SQL query)
        from app.repositories.follow_repository import FollowRepository
        follow_repo = FollowRepository(self.db)
        follow_statuses = await follow_repo.bulk_check_following_status(user_id, author_ids) if user_id else {}
        
        # Get engagement counts if not provided
        if engagement_counts is None:
            engagement_counts = {}
            # Query for engagement data in batch
            if is_postgresql:
                engagement_query = text("""
                    SELECT 
                        p.id,
                        COALESCE(reactions.reactions_count, 0) as reactions_count,
                        COALESCE(reactions.reaction_emoji_codes, ARRAY[]::text[]) as reaction_emoji_codes,
                        COALESCE(comments.comments_count, 0) as comments_count
                    FROM posts p
                    LEFT JOIN (
                        SELECT post_id,
                               COUNT(DISTINCT user_id) as reactions_count,
                               ARRAY_AGG(DISTINCT emoji_code ORDER BY emoji_code) as reaction_emoji_codes
                        FROM emoji_reactions
                        WHERE post_id = ANY(:post_ids) AND object_type = 'post'
                        GROUP BY post_id
                    ) reactions ON reactions.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(*) as comments_count
                        FROM comments
                        WHERE post_id = ANY(:post_ids)
                        GROUP BY post_id
                    ) comments ON comments.post_id = p.id
                    WHERE p.id = ANY(:post_ids)
                """)
                engagement_params: Dict[str, Any] = {"post_ids": post_ids}
            else:
                post_id_placeholders, post_id_params = build_in_clause_params(post_ids, "post_id")
                engagement_query = text(f"""
                    SELECT 
                        p.id,
                        COALESCE(reactions.reactions_count, 0) as reactions_count,
                        COALESCE(reactions.reaction_emoji_codes, '') as reaction_emoji_codes,
                        COALESCE(comments.comments_count, 0) as comments_count
                    FROM posts p
                    LEFT JOIN (
                        SELECT post_id,
                               COUNT(DISTINCT user_id) as reactions_count,
                               GROUP_CONCAT(DISTINCT emoji_code) as reaction_emoji_codes
                        FROM emoji_reactions
                        WHERE post_id IN ({post_id_placeholders}) AND object_type = 'post'
                        GROUP BY post_id
                    ) reactions ON reactions.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(*) as comments_count
                        FROM comments
                        WHERE post_id IN ({post_id_placeholders})
                        GROUP BY post_id
                    ) comments ON comments.post_id = p.id
                    WHERE p.id IN ({post_id_placeholders})
                """)
                engagement_params = post_id_params

            result = await self.execute_raw_query(engagement_query, engagement_params)
            for row in result.fetchall():
                raw_codes = getattr(row, "reaction_emoji_codes", None)
                if isinstance(raw_codes, str):
                    normalized_codes = [code for code in raw_codes.split(",") if code]
                else:
                    normalized_codes = list(raw_codes or [])
                engagement_counts[row.id] = {
                    'reactions': int(row.reactions_count or 0),
                    'comments': int(row.comments_count or 0),
                    'reaction_emoji_codes': normalized_codes
                }
        
        # Get user's reactions in batch
        if is_postgresql:
            reactions_query = text("""
                SELECT post_id, emoji_code
                FROM emoji_reactions
                WHERE post_id = ANY(:post_ids) AND user_id = :user_id AND object_type = 'post'
            """)
            reactions_params: Dict[str, Any] = {"post_ids": post_ids, "user_id": user_id}
        else:
            post_id_placeholders, post_id_params = build_in_clause_params(post_ids, "post_id")
            reactions_query = text(f"""
                SELECT post_id, emoji_code
                FROM emoji_reactions
                WHERE post_id IN ({post_id_placeholders}) AND user_id = :user_id AND object_type = 'post'
            """)
            reactions_params = {**post_id_params, "user_id": user_id}
        reactions_result = await self.execute_raw_query(reactions_query, reactions_params)
        user_reactions = {row.post_id: row.emoji_code for row in reactions_result.fetchall()}
        
        # Note: user_hearts check is removed as current_user_reaction already provides emoji_code, 
        # which can be checked for 'heart' on the client side.

        
        # Get images for all posts in batch
        if is_postgresql:
            images_query = text("""
                SELECT id, post_id, position, thumbnail_url, medium_url, original_url, width, height
                FROM post_images
                WHERE post_id = ANY(:post_ids)
                ORDER BY post_id, position
            """)
            images_params: Dict[str, Any] = {"post_ids": post_ids}
        else:
            post_id_placeholders, post_id_params = build_in_clause_params(post_ids, "post_id")
            images_query = text(f"""
                SELECT id, post_id, position, thumbnail_url, medium_url, original_url, width, height
                FROM post_images
                WHERE post_id IN ({post_id_placeholders})
                ORDER BY post_id, position
            """)
            images_params = post_id_params
        images_result = await self.execute_raw_query(images_query, images_params)
        images_by_post: Dict[str, List[Dict[str, Any]]] = {}
        
        for img_row in images_result.fetchall():
            post_id = img_row.post_id
            if post_id not in images_by_post:
                images_by_post[post_id] = []
            
            # ✅ Convert all image URLs to full URLs
            images_by_post[post_id].append({
                "id": img_row.id,
                "position": img_row.position,
                "thumbnail_url": storage.get_url(img_row.thumbnail_url) if img_row.thumbnail_url else None,
                "medium_url": storage.get_url(img_row.medium_url) if img_row.medium_url else None,
                "original_url": storage.get_url(img_row.original_url) if img_row.original_url else None,
                "width": img_row.width,
                "height": img_row.height
            })
        
        # Serialize posts
        serialized_posts = []
        for post in posts:
            # Get engagement data
            engagement = engagement_counts.get(post.id, {'reactions': 0, 'comments': 0})
            reactions_count = int(engagement.get('reactions', 0) or 0)
            comments_count = int(
                engagement.get('comments', engagement.get('comments_count', 0)) or 0
            )
            reaction_emoji_codes = engagement.get('reaction_emoji_codes', [])
            if isinstance(reaction_emoji_codes, str):
                reaction_emoji_codes = [code for code in reaction_emoji_codes.split(",") if code]
            elif not isinstance(reaction_emoji_codes, list):
                reaction_emoji_codes = list(reaction_emoji_codes or [])
            
            # Normalize location_data
            loc_data = post.location_data
            if isinstance(loc_data, str):
                try:
                    loc_data = json.loads(loc_data)
                except Exception:
                    loc_data = None
            
            # Normalize post_style
            post_style_data = post.post_style
            if isinstance(post_style_data, str):
                try:
                    post_style_data = json.loads(post_style_data)
                except Exception:
                    post_style_data = None
            
            # ✅ Build author data incorporating batch-loaded stats and follow status
            author_data = None
            if post.author:
                stats = author_stats.get(post.author_id, {})
                author_data = {
                    "id": post.author.id,
                    "username": post.author.username,
                    "display_name": post.author.display_name,
                    "name": post.author.display_name or post.author.username or post.author.name,
                    "image": storage.get_url(post.author.profile_image_url) if post.author.profile_image_url else None,
                    "follower_count": stats.get("followers_count", 0),
                    "following_count": stats.get("following_count", 0),
                    "posts_count": stats.get("posts_count", 0),
                    "is_following": follow_statuses.get(post.author_id, False) if user_id and user_id != post.author_id else None
                }

            # ✅ Convert legacy image_url
            image_url = None
            if post.image_url:
                image_url = storage.get_url(post.image_url)
            
            # Build post dict
            post_dict = {
                "id": post.id,
                "author_id": post.author_id,
                "content": post.content,
                "rich_content": post.rich_content,
                "post_style": post_style_data,
                "image_url": image_url,
                "images": images_by_post.get(post.id, []),
                "location": post.location,
                "location_data": loc_data,
                "is_public": PostPrivacyService.is_public_post(post),
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "updated_at": post.updated_at.isoformat() if post.updated_at else None,
                "author": author_data,
                "reactions_count": reactions_count,
                "comments_count": comments_count,
                "comments": [],
                "current_user_reaction": user_reactions.get(post.id),
                "reaction_emoji_codes": reaction_emoji_codes,
            }
            
            serialized_posts.append(post_dict)
        
        return serialized_posts
