"""
Post repository with specialized query methods.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_
from app.core.repository_base import BaseRepository
from app.core.storage import storage  # ← ADDED: Import storage adapter
from app.models.post import Post, PostType
from app.models.user import User


class PostRepository(BaseRepository):
    """Repository for Post model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Post)
    
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
            builder = builder.filter(Post.is_public == True)
        
        builder = builder.order_by(desc(Post.created_at)).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get posts by author")
        return result.scalars().all()
    
    async def get_public_feed(
        self, 
        limit: int = 20, 
        offset: int = 0,
        post_types: Optional[List[PostType]] = None
    ) -> List[Post]:
        """
        Get public posts for feed with optional type filtering.
        
        Args:
            limit: Maximum number of posts
            offset: Number of posts to skip
            post_types: Optional list of post types to filter by
            
        Returns:
            List[Post]: List of public posts
        """
        builder = self.query().filter(Post.is_public == True)
        
        if post_types:
            builder = builder.filter(Post.post_type.in_(post_types))
        
        builder = builder.order_by(desc(Post.created_at)).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get public feed")
        return result.scalars().all()
    
    async def get_posts_with_engagement(
        self,
        user_id: int,
        author_id: Optional[int] = None,
        public_only: bool = False,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get posts with engagement data (hearts, reactions) for a specific user.
        
        Args:
            user_id: ID of the current user (for personalized data)
            author_id: Optional author ID to filter by
            public_only: Whether to only return public posts
            limit: Maximum number of posts
            offset: Number of posts to skip
            
        Returns:
            List[Dict]: List of posts with engagement data and full URLs
        """
        import json
        import logging
        from fastapi.encoders import jsonable_encoder
        
        logger = logging.getLogger(__name__)
        
        # Build the base query conditions
        where_conditions = []
        if public_only:
            where_conditions.append("p.is_public = true")
        if author_id:
            where_conditions.append("p.author_id = :author_id")
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Hearts are implemented as emoji reactions with emoji_code='heart'
        has_likes_table = True  # Hearts available through emoji reactions system
        
        try:
            if has_likes_table:
                query = text(f"""
                    SELECT p.id,
                           p.author_id,
                           p.content,
                           p.post_style,
                           p.post_type,
                           p.image_url,
                           p.location,
                           p.location_data,
                           p.is_public,
                           p.created_at,
                           p.updated_at,
                           u.id as author_user_id,
                           u.username as author_username,
                           u.display_name as author_display_name,
                           u.email as author_email,
                           u.profile_image_url as author_profile_image_url,
                           COALESCE(hearts.hearts_count, 0) as hearts_count,
                           COALESCE(reactions.reactions_count, 0) as reactions_count,
                           COALESCE(comments.comments_count, 0) as comments_count,
                           user_reactions.emoji_code as current_user_reaction,
                           CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted
                    FROM posts p
                    LEFT JOIN users u ON u.id = p.author_id
                    LEFT JOIN (
                        SELECT post_id, COUNT(DISTINCT user_id) as hearts_count
                        FROM emoji_reactions
                        WHERE emoji_code = 'heart'
                        GROUP BY post_id
                    ) hearts ON hearts.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                        FROM emoji_reactions
                        GROUP BY post_id
                    ) reactions ON reactions.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(*) as comments_count
                        FROM comments
                        GROUP BY post_id
                    ) comments ON comments.post_id = p.id
                    LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                        AND user_reactions.user_id = :user_id
                    LEFT JOIN emoji_reactions user_hearts ON user_hearts.post_id = p.id 
                        AND user_hearts.user_id = :user_id AND user_hearts.emoji_code = 'heart'
                    {where_clause}
                    ORDER BY p.created_at DESC
                    LIMIT :limit OFFSET :offset
                """)
            else:
                query = text(f"""
                    SELECT p.id,
                           p.author_id,
                           p.content,
                           p.post_style,
                           p.post_type,
                           p.image_url,
                           p.location,
                           p.location_data,
                           p.is_public,
                           p.created_at,
                           p.updated_at,
                           u.id as author_user_id,
                           u.username as author_username,
                           u.display_name as author_display_name,
                           u.email as author_email,
                           u.profile_image_url as author_profile_image_url,
                           0 as hearts_count,
                           COALESCE(reactions.reactions_count, 0) as reactions_count,
                           COALESCE(comments.comments_count, 0) as comments_count,
                           user_reactions.emoji_code as current_user_reaction,
                           false as is_hearted
                    FROM posts p
                    LEFT JOIN users u ON u.id = p.author_id
                    LEFT JOIN (
                        SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                        FROM emoji_reactions
                        GROUP BY post_id
                    ) reactions ON reactions.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(*) as comments_count
                        FROM comments
                        GROUP BY post_id
                    ) comments ON comments.post_id = p.id
                    LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                        AND user_reactions.user_id = :user_id
                    {where_clause}
                    ORDER BY p.created_at DESC
                    LIMIT :limit OFFSET :offset
                """)
            
            params = {
                "user_id": user_id,
                "limit": limit,
                "offset": offset
            }
            
            if author_id:
                params["author_id"] = author_id
            
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
                    "post_type": row.post_type,
                    "image_url": image_url,  # ← Full URL now!
                    "images": [],  # Will be populated below with full URLs
                    "location": row.location,
                    "location_data": loc_data,
                    "is_public": row.is_public,
                    "created_at": str(row.created_at),
                    "updated_at": str(row.updated_at) if row.updated_at else None,
                    "author": {
                        "id": row.author_user_id,
                        "username": row.author_username,
                        "display_name": row.author_display_name,
                        "email": row.author_email,
                        "profile_image_url": author_profile_image_url  # ← Full URL now!
                    },
                    "hearts_count": int(row.hearts_count) if row.hearts_count else 0,
                    "reactions_count": int(row.reactions_count) if row.reactions_count else 0,
                    "comments_count": int(row.comments_count) if row.comments_count else 0,
                    "current_user_reaction": row.current_user_reaction,
                    "is_hearted": bool(row.is_hearted) if hasattr(row, 'is_hearted') else False
                }
                posts.append(post_dict)
                post_ids.append(row.id)

            # Fetch images for all posts in a single query (multi-image support)
            if post_ids:
                images_query = text("""
                    SELECT id, post_id, position, thumbnail_url, medium_url, original_url, width, height
                    FROM post_images
                    WHERE post_id = ANY(:post_ids)
                    ORDER BY post_id, position
                """)
                images_result = await self.execute_raw_query(images_query, {"post_ids": post_ids})
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

            logger.debug(f"post_repo.get_posts_with_engagement - returning {len(posts)} posts")
            return posts
            
        except Exception as e:
            logger.error(f"Error in get_posts_with_engagement: {e}")
            raise
    
    async def get_posts_by_type(
        self, 
        post_type: PostType, 
        limit: int = 20,
        offset: int = 0
    ) -> List[Post]:
        """
        Get posts filtered by type.
        
        Args:
            post_type: Type of posts to retrieve
            limit: Maximum number of posts
            offset: Number of posts to skip
            
        Returns:
            List[Post]: List of posts of the specified type
        """
        return await self.find_all(
            filters={"post_type": post_type, "is_public": True},
            order_by=desc(Post.created_at)
        )
    
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
        # Hearts are implemented as emoji reactions with emoji_code='heart'
        has_likes_table = True  # Hearts available through emoji reactions system
        
        if has_likes_table:
            query = text("""
                SELECT 
                    p.id,
                    COUNT(DISTINCT CASE WHEN er.emoji_code = 'heart' THEN er.id END) as hearts_count,
                    COUNT(DISTINCT CASE WHEN er.emoji_code != 'heart' THEN er.id END) as reactions_count,
                    COUNT(DISTINCT er.emoji_code) as unique_emoji_count
                FROM posts p
                LEFT JOIN emoji_reactions er ON er.post_id = p.id
                WHERE p.id = :post_id
                GROUP BY p.id
            """)
        else:
            query = text("""
                SELECT 
                    p.id,
                    0 as hearts_count,
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
                "hearts_count": 0,
                "reactions_count": 0,
                "unique_emoji_count": 0
            }
        
        return {
            "hearts_count": int(row.hearts_count) if row.hearts_count else 0,
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
                p.post_type,
                p.image_url,
                p.created_at,
                u.username as author_username,
                COUNT(DISTINCT l.id) as recent_hearts,
                COUNT(DISTINCT er.id) as recent_reactions,
                (COUNT(DISTINCT l.id) * 1.0 + COUNT(DISTINCT er.id) * 1.5) as engagement_score
            FROM posts p
            LEFT JOIN users u ON u.id = p.author_id
            LEFT JOIN likes l ON l.post_id = p.id 
                AND l.created_at >= NOW() - INTERVAL :hours HOUR
            LEFT JOIN emoji_reactions er ON er.post_id = p.id 
                AND er.created_at >= NOW() - INTERVAL :hours HOUR
            WHERE p.is_public = true
                AND p.created_at >= NOW() - INTERVAL :hours HOUR
            GROUP BY p.id, p.content, p.post_type, p.image_url, p.created_at, u.username
            HAVING engagement_score > 0
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
                "post_type": row.post_type,
                "image_url": image_url,  # ← Full URL now!
                "created_at": str(row.created_at),
                "author_username": row.author_username,
                "recent_hearts": int(row.recent_hearts) if row.recent_hearts else 0,
                "recent_reactions": int(row.recent_reactions) if row.recent_reactions else 0,
                "engagement_score": float(row.engagement_score) if row.engagement_score else 0.0
            })
        
        return trending_posts
    

    async def serialize_posts_for_feed(
        self,
        posts: List[Post],
        user_id: int,
        engagement_counts: Optional[Dict[str, Dict[str, int]]] = None,
        algorithm_scores: Optional[Dict[str, float]] = None,
        read_statuses: Optional[Dict[str, bool]] = None
    ) -> List[Dict[str, Any]]:
        """
        Serialize posts for feed with proper URL conversion.
        Reuses existing logic from get_posts_with_engagement but works with Post objects.
        
        Args:
            posts: List of Post objects to serialize
            user_id: Current user ID
            engagement_counts: Optional pre-calculated engagement data
            algorithm_scores: Optional algorithm scores for each post
            read_statuses: Optional read status for each post
            
        Returns:
            List[Dict]: Serialized posts with full URLs
        """
        import json
        import logging
        from sqlalchemy import text
        
        logger = logging.getLogger(__name__)
        
        if not posts:
            return []
        
        # Get post IDs for batch queries
        post_ids = [post.id for post in posts]
        
        # Get engagement counts if not provided
        if engagement_counts is None:
            engagement_counts = {}
            # Query for engagement data in batch
            engagement_query = text("""
                SELECT 
                    p.id,
                    COALESCE(hearts.hearts_count, 0) as hearts_count,
                    COALESCE(reactions.reactions_count, 0) as reactions_count,
                    COALESCE(comments.comments_count, 0) as comments_count
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as hearts_count
                    FROM emoji_reactions
                    WHERE emoji_code = 'heart' AND post_id = ANY(:post_ids)
                    GROUP BY post_id
                ) hearts ON hearts.post_id = p.id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    WHERE post_id = ANY(:post_ids)
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
            
            result = await self.execute_raw_query(engagement_query, {"post_ids": post_ids})
            for row in result.fetchall():
                engagement_counts[row.id] = {
                    'hearts': int(row.hearts_count or 0),
                    'reactions': int(row.reactions_count or 0),
                    'comments': int(row.comments_count or 0)
                }
        
        # Get user's reactions in batch
        reactions_query = text("""
            SELECT post_id, emoji_code
            FROM emoji_reactions
            WHERE post_id = ANY(:post_ids) AND user_id = :user_id
        """)
        reactions_result = await self.execute_raw_query(reactions_query, {
            "post_ids": post_ids,
            "user_id": user_id
        })
        user_reactions = {row.post_id: row.emoji_code for row in reactions_result.fetchall()}
        
        # Get user's hearts in batch
        hearts_query = text("""
            SELECT post_id
            FROM emoji_reactions
            WHERE post_id = ANY(:post_ids) AND user_id = :user_id AND emoji_code = 'heart'
        """)
        hearts_result = await self.execute_raw_query(hearts_query, {
            "post_ids": post_ids,
            "user_id": user_id
        })
        user_hearts = {row.post_id for row in hearts_result.fetchall()}
        
        # Get images for all posts in batch
        images_query = text("""
            SELECT id, post_id, position, thumbnail_url, medium_url, original_url, width, height
            FROM post_images
            WHERE post_id = ANY(:post_ids)
            ORDER BY post_id, position
        """)
        images_result = await self.execute_raw_query(images_query, {"post_ids": post_ids})
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
            engagement = engagement_counts.get(post.id, {'hearts': 0, 'reactions': 0, 'comments': 0})
            
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
            
            # ✅ Convert author profile image URL
            author_profile_image_url = None
            if post.author and post.author.profile_image_url:
                author_profile_image_url = storage.get_url(post.author.profile_image_url)
            
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
                "post_type": post.post_type.value if hasattr(post.post_type, 'value') else post.post_type,
                "image_url": image_url,
                "images": images_by_post.get(post.id, []),
                "location": post.location,
                "location_data": loc_data,
                "is_public": post.is_public,
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "updated_at": post.updated_at.isoformat() if post.updated_at else None,
                "author": {
                    "id": post.author.id,
                    "username": post.author.username,
                    "display_name": post.author.display_name,
                    "name": post.author.display_name or post.author.username,
                    "email": post.author.email,
                    "profile_image_url": author_profile_image_url,
                    "bio": getattr(post.author, 'bio', None),
                    "city": getattr(post.author, 'city', None),
                    "institutions": getattr(post.author, 'institutions', None),
                    "websites": getattr(post.author, 'websites', None),
                    "profile_photo_filename": getattr(post.author, 'profile_photo_filename', None)
                } if post.author else None,
                "hearts_count": engagement['hearts'],
                "reactions_count": engagement['reactions'],
                "comments_count": engagement['comments'],
                "current_user_reaction": user_reactions.get(post.id),
                "is_hearted": post.id in user_hearts
            }
            
            # Add optional fields
            if algorithm_scores and post.id in algorithm_scores:
                post_dict['algorithm_score'] = algorithm_scores[post.id]
            
            if read_statuses and post.id in read_statuses:
                post_dict['is_read'] = read_statuses[post.id]
                post_dict['is_unread'] = not read_statuses[post.id]
            
            serialized_posts.append(post_dict)
        
        return serialized_posts
