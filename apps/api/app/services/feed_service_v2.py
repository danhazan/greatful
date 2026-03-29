"""
Feed Service v2 — Simplified feed with SQL-computed scores and cursor pagination.

Replaces AlgorithmService + OptimizedAlgorithmService (~2,600 lines) with a single
~250-line service. Scores are computed in SQL using denormalized engagement counts
and follow relationship JOINs. Cursor-based pagination with frozen query_time
ensures stable ordering across pages.
"""

import base64
import binascii
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config.feed_config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.core.service_base import BaseService
from app.models.follow import Follow
from app.models.post import Post
from app.models.user import User
from app.repositories.post_repository import PostRepository
from app.services.post_privacy_service import PostPrivacyService

logger = logging.getLogger(__name__)

# --- Constants (tunable) ---
RECENCY_WINDOW_SECONDS = 604_800  # 7 days
RECENCY_MAX = 10.0
ENGAGEMENT_MAX = 5.0
RELATIONSHIP_MUTUAL = 3.0
RELATIONSHIP_FOLLOWING = 2.0
RELATIONSHIP_FOLLOWED_BY = 1.0
OWN_POST_PHASE1_MAX = 5.0
OWN_POST_PHASE1_SECONDS = 3_600  # 1 hour
OWN_POST_PHASE2_MAX = 2.0
OWN_POST_PHASE2_SECONDS = 18_000  # 5 hours (1h–6h)
MAX_CONSECUTIVE_SAME_AUTHOR = 2
CURSOR_VERSION = 1

# Engagement weights (inside ln())
WEIGHT_COMMENTS = 3
WEIGHT_SHARES = 4
WEIGHT_REACTIONS = 2
WEIGHT_HEARTS = 1


class FeedServiceV2(BaseService):
    """Simplified feed service with SQL-computed scores and cursor pagination."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self._is_pg = self._detect_postgresql()

    def _detect_postgresql(self) -> bool:
        try:
            return self.db.bind.dialect.name == "postgresql"
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_feed(
        self,
        user_id: int,
        cursor: Optional[str] = None,
        page_size: int = DEFAULT_PAGE_SIZE,
        debug: bool = False,
    ) -> Dict[str, Any]:
        """
        Get the user's feed with cursor-based pagination.

        Returns:
            {"posts": [...], "nextCursor": str | None}
        """
        page_size = max(1, min(page_size, MAX_PAGE_SIZE))

        # Decode cursor or start fresh
        if cursor:
            cursor_data = self._decode_cursor(cursor)
            query_time = cursor_data["query_time"]
        else:
            cursor_data = None
            query_time = datetime.now(timezone.utc)

        # Build and execute scored query
        query, params = self._build_feed_query(user_id, query_time, cursor_data, page_size)
        result = await self.db.execute(query, params)
        rows = result.fetchall()

        # Determine if there are more pages
        has_more = len(rows) > page_size
        rows = rows[:page_size]

        if not rows:
            return {"posts": [], "nextCursor": None}

        # Extract Post objects and scores
        posts = []
        scores = {}
        debug_data = {} if debug else None

        for row in rows:
            post = self._row_to_post(row)
            score = float(row.feed_score)
            posts.append(post)
            scores[post.id] = score

            if debug:
                debug_data[post.id] = {
                    "score": round(score, 4),
                    "recency": round(float(row.recency_score), 4),
                    "engagement": round(float(row.engagement_score), 4),
                    "relationship": round(float(row.relationship_score), 4),
                    "ownPostBoost": round(float(row.own_post_score), 4),
                }

        # Load authors in batch (raw SQL rows don't include ORM relationships)
        author_ids = list({p.author_id for p in posts if p.author_id})
        if author_ids:
            author_result = await self.db.execute(
                select(User).where(User.id.in_(author_ids))
            )
            authors_by_id = {u.id: u for u in author_result.scalars().all()}
            for post in posts:
                post.author = authors_by_id.get(post.author_id)

        # Apply lightweight author spacing
        posts = self._apply_author_spacing(posts)

        # Serialize using existing batch serialization (engagement, images, author stats, etc.)
        post_repo = PostRepository(self.db)
        serialized = await post_repo.serialize_posts_for_feed(
            posts=posts,
            user_id=user_id,
        )

        # Build a lookup for privacy data from the Post objects
        privacy_by_id = {p.id: getattr(p, "privacy_level", None) for p in posts}

        # Add privacy metadata
        for post_dict in serialized:
            # Include privacy_level so frontend doesn't need a separate hydration call
            if post_dict["id"] in privacy_by_id:
                post_dict["privacy_level"] = privacy_by_id[post_dict["id"]]
            if debug and post_dict["id"] in debug_data:
                post_dict["_debug"] = debug_data[post_dict["id"]]

        # Build next cursor from last post in the result
        next_cursor = None
        if has_more and rows:
            last_row = rows[-1]
            last_created_at = last_row.created_at
            if isinstance(last_created_at, str):
                last_created_at = datetime.fromisoformat(last_created_at)
            next_cursor = self._encode_cursor(
                query_time=query_time,
                score=float(last_row.feed_score),
                created_at=last_created_at,
                post_id=last_row.id,
            )

        return {"posts": serialized, "nextCursor": next_cursor}

    # ------------------------------------------------------------------
    # Query building
    # ------------------------------------------------------------------

    def _build_feed_query(
        self,
        user_id: int,
        query_time: datetime,
        cursor_data: Optional[Dict],
        page_size: int,
    ) -> Tuple[Any, Dict]:
        """Build the CTE-based scored feed query."""
        if self._is_pg:
            return self._build_pg_query(user_id, query_time, cursor_data, page_size)
        else:
            return self._build_sqlite_query(user_id, query_time, cursor_data, page_size)

    def _build_pg_query(
        self,
        user_id: int,
        query_time: datetime,
        cursor_data: Optional[Dict],
        page_size: int,
    ) -> Tuple[Any, Dict]:
        """PostgreSQL query with CTE and can_view_post."""
        cursor_filter = ""
        if cursor_data:
            cursor_filter = (
                "AND (feed_score, created_at, id) < (:cursor_s, CAST(:cursor_t AS timestamptz), :cursor_id)"
            )

        sql = text(f"""
            WITH scored AS (
                SELECT p.*,
                    (10.0 * GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) / {RECENCY_WINDOW_SECONDS}.0))
                        AS recency_score,
                    LEAST({ENGAGEMENT_MAX}, LN(1
                        + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                        + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                        + COALESCE(p.reactions_count, 0) * {WEIGHT_REACTIONS}
                        + COALESCE(p.hearts_count, 0) * {WEIGHT_HEARTS}
                    )) AS engagement_score,
                    CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                    END AS relationship_score,
                    CASE
                        WHEN p.author_id = :uid
                             AND EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid
                             AND EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                    END AS own_post_score,
                    (10.0 * GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) / {RECENCY_WINDOW_SECONDS}.0))
                    + LEAST({ENGAGEMENT_MAX}, LN(1
                        + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                        + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                        + COALESCE(p.reactions_count, 0) * {WEIGHT_REACTIONS}
                        + COALESCE(p.hearts_count, 0) * {WEIGHT_HEARTS}
                    ))
                    + CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                      END
                    + CASE
                        WHEN p.author_id = :uid
                             AND EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid
                             AND EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at)) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                      END
                    AS feed_score
                FROM posts p
                LEFT JOIN follows f_out
                    ON f_out.follower_id = :uid AND f_out.followed_id = p.author_id
                    AND f_out.status = 'active' AND p.author_id != :uid
                LEFT JOIN follows f_in
                    ON f_in.follower_id = p.author_id AND f_in.followed_id = :uid
                    AND f_in.status = 'active' AND p.author_id != :uid
                WHERE can_view_post(:uid, p.id::uuid)
            )
            SELECT * FROM scored
            WHERE 1=1 {cursor_filter}
            ORDER BY feed_score DESC, created_at DESC, id DESC
            LIMIT :lim
        """)

        params = {"uid": user_id, "qt": query_time, "lim": page_size + 1}
        if cursor_data:
            params["cursor_s"] = cursor_data["score"]
            params["cursor_t"] = cursor_data["created_at"]
            params["cursor_id"] = cursor_data["id"]

        return sql, params

    def _build_sqlite_query(
        self,
        user_id: int,
        query_time: datetime,
        cursor_data: Optional[Dict],
        page_size: int,
    ) -> Tuple[Any, Dict]:
        """SQLite query for tests. Uses julianday for time math, LN/GREATEST registered as custom functions."""
        cursor_filter = ""
        if cursor_data:
            cursor_filter = (
                "AND (feed_score, created_at, id) < (:cursor_s, :cursor_t, :cursor_id)"
            )

        age_expr = f"(julianday(:qt) - julianday(p.created_at)) * 86400"
        # Build visibility clause for SQLite (inline instead of can_view_post function)
        visibility_clause = """
            (p.author_id = :uid
             OR p.privacy_level = 'public'
             OR (p.privacy_level IS NULL AND p.is_public = 1))
        """

        sql = text(f"""
            WITH scored AS (
                SELECT p.*,
                    (10.0 * GREATEST(0, 1.0 - ({age_expr}) / {RECENCY_WINDOW_SECONDS}.0))
                        AS recency_score,
                    LEAST({ENGAGEMENT_MAX}, LN(1
                        + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                        + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                        + COALESCE(p.reactions_count, 0) * {WEIGHT_REACTIONS}
                        + COALESCE(p.hearts_count, 0) * {WEIGHT_HEARTS}
                    )) AS engagement_score,
                    CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                    END AS relationship_score,
                    CASE
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - ({age_expr}) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (({age_expr}) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                    END AS own_post_score,
                    (10.0 * GREATEST(0, 1.0 - ({age_expr}) / {RECENCY_WINDOW_SECONDS}.0))
                    + LEAST({ENGAGEMENT_MAX}, LN(1
                        + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                        + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                        + COALESCE(p.reactions_count, 0) * {WEIGHT_REACTIONS}
                        + COALESCE(p.hearts_count, 0) * {WEIGHT_HEARTS}
                    ))
                    + CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                      END
                    + CASE
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - ({age_expr}) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (({age_expr}) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                      END
                    AS feed_score
                FROM posts p
                LEFT JOIN follows f_out
                    ON f_out.follower_id = :uid AND f_out.followed_id = p.author_id
                    AND f_out.status = 'active' AND p.author_id != :uid
                LEFT JOIN follows f_in
                    ON f_in.follower_id = p.author_id AND f_in.followed_id = :uid
                    AND f_in.status = 'active' AND p.author_id != :uid
                WHERE {visibility_clause}
            )
            SELECT * FROM scored
            WHERE 1=1 {cursor_filter}
            ORDER BY feed_score DESC, created_at DESC, id DESC
            LIMIT :lim
        """)

        params: Dict[str, Any] = {
            "uid": user_id,
            "qt": query_time.isoformat(),
            "lim": page_size + 1,
        }
        if cursor_data:
            params["cursor_s"] = cursor_data["score"]
            # SQLite stores datetimes as "YYYY-MM-DD HH:MM:SS.ffffff" (no T, no tz)
            # Match this format for correct text comparison
            params["cursor_t"] = cursor_data["created_at"].strftime("%Y-%m-%d %H:%M:%S.%f")
            params["cursor_id"] = cursor_data["id"]

        return sql, params

    # ------------------------------------------------------------------
    # Post object reconstruction from raw row
    # ------------------------------------------------------------------

    def _row_to_post(self, row) -> Post:
        """Convert a raw SQL row back to a Post object for serialization."""
        post = Post()
        for col in Post.__table__.columns:
            if hasattr(row, col.name):
                value = getattr(row, col.name)
                # SQLite returns datetime as strings — parse them back
                if isinstance(value, str) and col.name in ("created_at", "updated_at"):
                    try:
                        value = datetime.fromisoformat(value)
                    except (ValueError, TypeError):
                        pass
                setattr(post, col.name, value)
        return post

    # ------------------------------------------------------------------
    # Author spacing
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_author_spacing(
        posts: List[Post], max_consecutive: int = MAX_CONSECUTIVE_SAME_AUTHOR
    ) -> List[Post]:
        """Reorder to prevent more than max_consecutive posts from the same author."""
        if len(posts) <= max_consecutive:
            return posts

        result: List[Post] = []
        deferred: List[Post] = []

        for post in posts:
            consecutive = sum(
                1 for p in result[-max_consecutive:] if p.author_id == post.author_id
            )
            if consecutive >= max_consecutive:
                deferred.append(post)
            else:
                result.append(post)

        return result + deferred

    # ------------------------------------------------------------------
    # Cursor encoding / decoding
    # ------------------------------------------------------------------

    @staticmethod
    def _encode_cursor(
        query_time: datetime, score: float, created_at: datetime, post_id: str
    ) -> str:
        """Encode pagination cursor as base64url JSON."""
        # Ensure timezone-aware
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if query_time.tzinfo is None:
            query_time = query_time.replace(tzinfo=timezone.utc)

        payload = {
            "v": CURSOR_VERSION,
            "qt": query_time.isoformat(),
            "s": score,
            "t": created_at.isoformat(),
            "id": str(post_id),
        }
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()

    @staticmethod
    def _decode_cursor(cursor: str) -> Dict[str, Any]:
        """Decode and validate a pagination cursor."""
        try:
            payload = json.loads(base64.urlsafe_b64decode(cursor))
        except (json.JSONDecodeError, binascii.Error, UnicodeDecodeError) as exc:
            raise ValueError("Invalid cursor encoding") from exc

        if payload.get("v") != CURSOR_VERSION:
            raise ValueError(f"Unsupported cursor version: {payload.get('v')}")

        required = {"v", "qt", "s", "t", "id"}
        missing = required - set(payload.keys())
        if missing:
            raise ValueError(f"Missing cursor fields: {missing}")

        return {
            "query_time": datetime.fromisoformat(payload["qt"]),
            "score": float(payload["s"]),
            "created_at": datetime.fromisoformat(payload["t"]),
            "id": str(payload["id"]),
        }
