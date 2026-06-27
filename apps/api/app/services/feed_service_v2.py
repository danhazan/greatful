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
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config.feed_config import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    CANDIDATE_MULTIPLIER,
    CURSOR_VERSION,
    RECENCY_WINDOW_SECONDS,
    RECENCY_MAX,
    ENGAGEMENT_MAX,
    COMBINED_ENGAGEMENT_MAX,
    WEIGHT_COMMENTS,
    WEIGHT_SHARES,
    WEIGHT_REACTIONS,
    DIVERSITY_BONUS_PER_TYPE,
    DIVERSITY_BONUS_MAX_TYPES,
    RECENT_ENGAGEMENT_WINDOW,
    RECENT_ENGAGEMENT_MAX,
    RELATIONSHIP_MUTUAL,
    RELATIONSHIP_FOLLOWING,
    RELATIONSHIP_FOLLOWED_BY,
    OWN_POST_PHASE1_MAX,
    OWN_POST_PHASE1_SECONDS,
    OWN_POST_PHASE2_MAX,
    OWN_POST_PHASE2_SECONDS,
    USER_REACTION_BOOST,
    DISCOVERY_BOOST,
    DISCOVERY_ENGAGEMENT_THRESHOLD,
    JITTER_MAX,
    AUTHOR_SPACING_WINDOW,
    AUTHOR_SPACING_MAX_PER_WINDOW,
    TYPE_FEED_FILTERS,
    FILTER_BOOST_WEIGHT,
    FILTER_BOOST_MAX,
)
from app.core.service_base import BaseService
from app.models.post import Post
from app.models.user import User
from app.repositories.post_repository import PostRepository

logger = logging.getLogger(__name__)


@dataclass
class PredicateGroup:
    """A group of SQL predicates combined with a boolean operator."""
    operator: str  # 'AND' or 'OR'
    predicates: List[str] = field(default_factory=list)


def build_grouped_predicate_clause(groups: List[PredicateGroup]) -> str:
    """Build a WHERE clause from predicate groups. Groups combine with AND.
    Within each group, predicates combine with the group's operator.
    Empty groups are skipped. Returns empty string if no groups are non-empty.
    """
    clauses: List[str] = []
    for group in groups:
        if not group.predicates:
            continue
        inner = f" {group.operator} ".join(group.predicates)
        clauses.append(f"({inner})")
    if clauses:
        return " AND " + " AND ".join(clauses)
    return ""


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
        type_required: Optional[List[str]] = None,
        type_required_any: Optional[List[str]] = None,
        type_boost: Optional[List[str]] = None,
        date_mode: Optional[str] = None,
        date_start: Optional[str] = None,
        date_end: Optional[str] = None,
        author_mode: Optional[str] = None,
        author_ids: Optional[List[int]] = None,
        keyword_mode: Optional[str] = None,
        keyword: Optional[str] = None,
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

        filter_spec = self._normalize_feed_filters(
            query_time=query_time,
            type_required=type_required,
            type_required_any=type_required_any,
            type_boost=type_boost,
            date_mode=date_mode,
            date_start=date_start,
            date_end=date_end,
            author_mode=author_mode,
            author_ids=author_ids,
            keyword_mode=keyword_mode,
            keyword=keyword,
        )
        logger.info(
            "[FEED_FILTERS][service-entry] user_id=%s filters=%s",
            user_id,
            filter_spec["debug"],
        )

        # Fetch a wider candidate pool so author spacing has room to diversify
        fetch_size = page_size * CANDIDATE_MULTIPLIER
        query, params = self._build_feed_query(
            user_id=user_id,
            query_time=query_time,
            cursor_data=cursor_data,
            page_size=fetch_size,
            filter_spec=filter_spec,
        )
        logger.info(
            "[FEED_FILTERS][query-exec] user_id=%s params_keys=%s",
            user_id,
            sorted(params.keys()),
        )
        result = await self.db.execute(query, params)
        rows = result.fetchall()

        if not rows:
            return {"posts": [], "nextCursor": None}

        # Convert all candidates to Post objects and collect debug data
        candidates = []
        debug_data = {} if debug else None

        for row in rows:
            post = self._row_to_post(row)
            score = float(row.feed_score)
            post._feed_score = score
            post._feed_row = row
            candidates.append(post)

            if debug:
                created = post.created_at
                if created and not getattr(created, 'tzinfo', None):
                    created = created.replace(tzinfo=timezone.utc)
                age_seconds = (query_time - created).total_seconds() if created else 0
                debug_data[post.id] = {
                    "score": round(score, 4),
                    "recency": round(float(row.recency_score), 4),
                    "engagement": round(float(row.engagement_score), 4),
                    "relationship": round(float(row.relationship_score), 4),
                    "ownPostBoost": round(float(row.own_post_score), 4),
                    "recentEngagement": round(float(row.recent_engagement_score), 4),
                    "userReaction": round(float(row.user_reaction_score), 4),
                    "discovery": round(float(row.discovery_score), 4),
                    "filterBoost": round(float(getattr(row, "filter_boost_score", 0) or 0), 4),
                    "jitter": round(float(row.jitter_score), 4),
                    "postAgeHours": round(age_seconds / 3600, 2),
                    "authorId": post.author_id,
                    "userHasReacted": float(row.user_reaction_score) > 0,
                    "rawCounts": {
                        "reactions": int(getattr(row, "reactions_count", 0) or 0),
                        "comments": getattr(post, "comments_count", 0) or 0,
                        "shares": getattr(post, "shares_count", 0) or 0,
                        "diversityBonus": round(float(getattr(row, "diversity_bonus_score", 0) or 0), 4),
                    },
                }

        # Load authors in batch
        author_ids = list({p.author_id for p in candidates if p.author_id})
        if author_ids:
            author_result = await self.db.execute(
                select(User).where(User.id.in_(author_ids))
            )
            authors_by_id = {u.id: u for u in author_result.scalars().all()}
            for post in candidates:
                post.author = authors_by_id.get(post.author_id)

        # Apply author spacing across the full candidate pool
        if debug:
            pre_spacing = [(i, p.id, p.author_id) for i, p in enumerate(candidates)]
        spaced = self._apply_author_spacing(candidates)
        if debug:
            post_spacing = [(i, p.id, p.author_id) for i, p in enumerate(spaced)]
            spacing_log = []
            pre_id_to_idx = {item[1]: item[0] for item in pre_spacing}
            for new_idx, post_id, author_id in post_spacing:
                old_idx = pre_id_to_idx.get(post_id, -1)
                if old_idx != new_idx:
                    spacing_log.append({
                        "postId": post_id,
                        "authorId": author_id,
                        "fromIndex": old_idx,
                        "toIndex": new_idx,
                    })

        # Take the page from the spaced results
        has_more = len(spaced) > page_size
        posts = spaced[:page_size]

        # Serialize the page
        post_repo = PostRepository(self.db)
        serialized = await post_repo.serialize_posts_for_feed(
            posts=posts,
            user_id=user_id,
        )

        privacy_by_id = {p.id: getattr(p, "privacy_level", None) for p in posts}

        for post_dict in serialized:
            if post_dict["id"] in privacy_by_id:
                post_dict["privacy_level"] = privacy_by_id[post_dict["id"]]
            if debug and post_dict["id"] in debug_data:
                post_dict["_debug"] = debug_data[post_dict["id"]]

        # Build next cursor from the logical SQL boundary, not the reordered spaced last item.
        # This prevents "skipping" high-ranked posts that were pushed down by author spacing.
        next_cursor = None
        if has_more and len(candidates) >= page_size:
            # The boundary is the page_size-th item in the ORIGINAL SQL result
            boundary_post = candidates[page_size - 1]
            last_created_at = boundary_post.created_at
            if isinstance(last_created_at, str):
                last_created_at = datetime.fromisoformat(last_created_at)

            next_cursor = self._encode_cursor(
                query_time=query_time,
                score=float(boundary_post._feed_score),
                created_at=last_created_at,
                post_id=boundary_post.id,
            )

        response = {"posts": serialized, "nextCursor": next_cursor}
        if debug:
            response["_debugMeta"] = {
                "queryTime": query_time.isoformat(),
                "postCount": len(serialized),
                "candidateCount": len(candidates),
                "spacingMoves": spacing_log,
            }
        
        # Runtime invariant check: No private post leakage
        for post_dict in serialized:
            privacy = post_dict.get("privacy_level")
            if privacy == "private" and post_dict.get("author_id") != user_id:
                logger.error(
                    f"[FEED_PRIVACY_ERROR] Private post leaked to user {user_id}: post_id={post_dict['id']}, "
                    f"author_id={post_dict.get('author_id')}. Invariant violated: private posts must not "
                    f"appear in other users' feeds. "
                    f"See SYSTEM_CONTRACT_MAP.md#feed-rendering"
                )
                from app.core.exceptions import InternalServerError
                raise InternalServerError("Feed privacy invariant violated: private post leaked to unauthorized user")
        
        return response

    # ------------------------------------------------------------------
    # Query building
    # ------------------------------------------------------------------

    def _build_feed_query(
        self,
        user_id: int,
        query_time: datetime,
        cursor_data: Optional[Dict],
        page_size: int,
        filter_spec: Dict[str, Any],
    ) -> Tuple[Any, Dict]:
        """Build the CTE-based scored feed query."""
        if self._is_pg:
            return self._build_pg_query(
                user_id,
                query_time,
                cursor_data,
                page_size,
                filter_spec,
            )
        else:
            return self._build_sqlite_query(
                user_id,
                query_time,
                cursor_data,
                page_size,
                filter_spec,
            )

    @staticmethod
    def _normalize_feed_filters(
        query_time: datetime,
        type_required: Optional[List[str]],
        type_required_any: Optional[List[str]],
        type_boost: Optional[List[str]],
        date_mode: Optional[str],
        date_start: Optional[str],
        date_end: Optional[str],
        author_mode: Optional[str],
        author_ids: Optional[List[int]],
        keyword_mode: Optional[str],
        keyword: Optional[str],
    ) -> Dict[str, Any]:
        allowed_types = set(TYPE_FEED_FILTERS)
        allowed_modes = {"boost", "required"}
        params: Dict[str, Any] = {}

        def _normalize_type_values(values: Optional[List[str]]) -> List[str]:
            normalized: List[str] = []
            for value in values or []:
                key = str(value).strip().lower()
                if key not in allowed_types:
                    raise ValueError(f"Unsupported type filter: {value}")
                if key not in normalized:
                    normalized.append(key)
            return normalized

        required_types = _normalize_type_values(type_required)
        required_any_types = _normalize_type_values(type_required_any)
        boost_types = _normalize_type_values(type_boost)
        overlapping_types = set(required_types) & set(boost_types)
        if overlapping_types:
            names = ", ".join(sorted(overlapping_types))
            raise ValueError(f"Type filters cannot be both required and boost: {names}")
        overlapping_any = set(required_any_types) & set(boost_types)
        if overlapping_any:
            names = ", ".join(sorted(overlapping_any))
            raise ValueError(f"Type filters cannot be both required_any and boost: {names}")
        overlap_both = set(required_types) & set(required_any_types)
        if overlap_both:
            names = ", ".join(sorted(overlap_both))
            raise ValueError(f"A type cannot be in both type_required and type_required_any: {names}")

        def _normalize_mode(value: Optional[str], field: str) -> Optional[str]:
            if value is None or str(value).strip() == "":
                return None
            mode = str(value).strip().lower()
            if mode not in allowed_modes:
                raise ValueError(f"{field} must be one of: boost, required")
            return mode

        normalized_date_mode = _normalize_mode(date_mode, "date_mode")
        if normalized_date_mode is not None:
            if not (date_start and date_end):
                raise ValueError("date_start and date_end are both required when date_mode is provided")
            try:
                start_dt = datetime.fromisoformat(date_start)
                end_dt = datetime.fromisoformat(date_end)
            except ValueError as exc:
                raise ValueError("date_start and date_end must be valid ISO 8601 timestamps") from exc
            if start_dt.tzinfo is None:
                raise ValueError("date_start must be timezone-aware (UTC)")
            if end_dt.tzinfo is None:
                raise ValueError("date_end must be timezone-aware (UTC)")
            from app.config.feed_config import MIN_DATE
            from datetime import timedelta
            min_dt = datetime.fromisoformat(MIN_DATE).replace(tzinfo=timezone.utc) - timedelta(days=1)
            if start_dt < min_dt:
                raise ValueError(f"date_start must not be earlier than {MIN_DATE}")
            if end_dt < min_dt:
                raise ValueError(f"date_end must not be earlier than {MIN_DATE}")
            if end_dt <= start_dt:
                raise ValueError("date_end must be after date_start")
            if end_dt > query_time + timedelta(days=1):
                raise ValueError("date_end must not be in the future")
            params["date_start_utc"] = start_dt
            params["date_end_utc"] = end_dt
            date_filter: Optional[Dict[str, Any]] = {
                "mode": normalized_date_mode,
                "range": {
                    "start": start_dt.isoformat(),
                    "end": end_dt.isoformat(),
                },
            }
        else:
            date_filter = None

        # Author filters: one mode, one deduped selected set.
        normalized_author_mode = _normalize_mode(author_mode, "author_mode")
        deduped_author_ids: List[int] = []
        for raw_id in author_ids or []:
            try:
                author_id = int(raw_id)
            except (TypeError, ValueError) as exc:
                raise ValueError("author_ids must be positive integers") from exc
            if author_id <= 0:
                raise ValueError("author_ids must be positive integers")
            if author_id not in deduped_author_ids:
                deduped_author_ids.append(author_id)
        if len(deduped_author_ids) > 50:
            raise ValueError("author_ids may include at most 50 users")
        if normalized_author_mode is None and deduped_author_ids:
            raise ValueError("author_mode is required when author_ids are provided")
        if normalized_author_mode and not deduped_author_ids:
            raise ValueError("author_ids are required when author_mode is provided")
        for idx, author_id in enumerate(deduped_author_ids):
            params[f"author_id_{idx}"] = author_id

        # Keyword filters: one mode, one single-line query.
        normalized_keyword_mode = _normalize_mode(keyword_mode, "keyword_mode")
        normalized_keyword = " ".join(str(keyword or "").split()).strip()
        if len(normalized_keyword) > 200:
            raise ValueError("keyword must be 200 characters or fewer")
        if normalized_keyword_mode is None and normalized_keyword:
            raise ValueError("keyword_mode is required when keyword is provided")
        if normalized_keyword_mode and not normalized_keyword:
            raise ValueError("keyword is required when keyword_mode is provided")
        if normalized_keyword:
            params["keyword_query"] = normalized_keyword
            escaped = (
                normalized_keyword
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            params["keyword_like"] = f"%{escaped.lower()}%"

        return {
            "type_required": required_types,
            "type_required_any": required_any_types,
            "type_boost": boost_types,
            "date": date_filter,
            "author": {
                "mode": normalized_author_mode,
                "ids": deduped_author_ids,
            } if normalized_author_mode else None,
            "keyword": {
                "mode": normalized_keyword_mode,
                "text": normalized_keyword,
            } if normalized_keyword_mode else None,
            "params": params,
            "debug": {
                "typeRequired": required_types,
                "typeRequiredAny": required_any_types,
                "typeBoost": boost_types,
                "date": date_filter,
                "authorMode": normalized_author_mode,
                "authorCount": len(deduped_author_ids),
                "keywordMode": normalized_keyword_mode,
                "hasKeyword": bool(normalized_keyword),
            },
        }

    @staticmethod
    def _image_predicate() -> str:
        return (
            "(NULLIF(TRIM(p.image_url), '') IS NOT NULL "
            "OR EXISTS (SELECT 1 FROM post_images pi WHERE pi.post_id = p.id))"
        )

    @staticmethod
    def _build_filter_clauses(filter_spec: Dict[str, Any], dialect: str) -> Dict[str, Any]:
        """Build filter predicates using the generic grouped-predicate engine.

        Predicate groups are built from type_required (AND), type_required_any (OR),
        and type_boost, plus optional date/author/keyword filters.
        Groups combine with AND; within each group the operator joins predicates.
        """
        date_range_predicate = "(p.created_at >= :date_start_utc AND p.created_at < :date_end_utc)"

        base_predicates = {
            "mine": "p.author_id = :uid",
            "followed": "f_out.id IS NOT NULL",
            "followers": "f_in.id IS NOT NULL",
            "public": "NOT ((p.author_id = :uid) OR (f_out.id IS NOT NULL) OR (f_in.id IS NOT NULL))",
            "images": FeedServiceV2._image_predicate(),
        }
        author = filter_spec.get("author")
        if author:
            placeholders = ", ".join(f":author_id_{idx}" for idx, _ in enumerate(author["ids"]))
            base_predicates["authors"] = f"p.author_id IN ({placeholders})"

        keyword = filter_spec.get("keyword")
        if keyword:
            if dialect == "postgresql":
                base_predicates["keyword"] = (
                    "to_tsvector('simple', COALESCE(p.content, '')) "
                    "@@ plainto_tsquery('simple', :keyword_query)"
                )
            else:
                base_predicates["keyword"] = (
                    "LOWER(COALESCE(p.content, '')) LIKE :keyword_like ESCAPE '\\'"
                )

        required_names = list(filter_spec.get("type_required", []))
        required_any_names = list(filter_spec.get("type_required_any", []))
        boost_names = list(filter_spec.get("type_boost", []))

        date_filter = filter_spec.get("date")
        if date_filter:
            base_predicates["date_range"] = date_range_predicate
            if date_filter["mode"] == "required":
                required_names.append("date_range")
            else:
                boost_names.append("date_range")

        if author:
            if author["mode"] == "required":
                required_names.append("authors")
            else:
                boost_names.append("authors")

        if keyword:
            if keyword["mode"] == "required":
                required_names.append("keyword")
            else:
                boost_names.append("keyword")

        # Build predicate groups using the generic grouped-predicate engine
        groups: List[PredicateGroup] = []

        req_preds = [base_predicates[n] for n in required_names if n in base_predicates]
        if req_preds:
            groups.append(PredicateGroup(operator='AND', predicates=req_preds))

        any_preds = [base_predicates[n] for n in required_any_names if n in base_predicates]
        if any_preds:
            groups.append(PredicateGroup(operator='OR', predicates=any_preds))

        required_clause = build_grouped_predicate_clause(groups)

        # BOOST filters: ranking boost only (same predicates used)
        boost_predicates = [base_predicates[name] for name in boost_names if name in base_predicates]
        if boost_predicates:
            boost_sum = " + ".join(
                f"(CASE WHEN ({predicate}) THEN {FILTER_BOOST_WEIGHT} ELSE 0 END)"
                for predicate in boost_predicates
            )
            boost_expr = f"LEAST({FILTER_BOOST_MAX}, ({boost_sum}))"
        else:
            boost_expr = "0"

        return {
            "required_clause": required_clause,
            "boost_expr": boost_expr,
            "required_predicates": req_preds,
            "required_any_predicates": any_preds,
            "boost_predicates": boost_predicates,
            "params": filter_spec.get("params", {}),
        }

    def _build_pg_query(
        self,
        user_id: int,
        query_time: datetime,
        cursor_data: Optional[Dict],
        page_size: int,
        filter_spec: Dict[str, Any],
    ) -> Tuple[Any, Dict]:
        """PostgreSQL query with CTE and can_view_post."""

        cursor_filter = ""
        if cursor_data:
            cursor_filter = (
                "AND (feed_score, created_at, id) < (:cursor_s, CAST(:cursor_t AS timestamptz), :cursor_id)"
            )

        age_pg = "EXTRACT(EPOCH FROM (CAST(:qt AS timestamptz) - p.created_at))"
        filter_clauses = self._build_filter_clauses(filter_spec, "postgresql")
        logger.info(
            "[FEED_FILTERS][sql] dialect=postgres filters=%s required_clause=%s boost_count=%s",
            filter_spec["debug"],
            filter_clauses["required_clause"] or "(none)",
            len(filter_clauses["boost_predicates"]),
        )

        sql = text(f"""
            WITH scored AS (
                SELECT p.*,
                    -- recency: 10 -> 0 over 7 days
                    ({RECENCY_MAX} * GREATEST(0, 1.0 - ({age_pg}) / {RECENCY_WINDOW_SECONDS}.0))
                        AS recency_score,
                    -- engagement: log-scaled, capped; all reactions weighted equally
                    LEAST({ENGAGEMENT_MAX}, LN(1
                        + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                        + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                        + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}
                    )) AS engagement_score,
                    -- diversity bonus: +{DIVERSITY_BONUS_PER_TYPE} per unique emoji type, capped at {DIVERSITY_BONUS_MAX_TYPES} types
                    LEAST({DIVERSITY_BONUS_MAX_TYPES},
                        (SELECT COUNT(DISTINCT emoji_code) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                    ) * {DIVERSITY_BONUS_PER_TYPE} AS diversity_bonus_score,
                    -- relationship: scaled by recency so it fades with age
                    CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                    END
                    * GREATEST(0, 1.0 - ({age_pg}) / {RECENCY_WINDOW_SECONDS}.0)
                    AS relationship_score,
                    -- own-post boost: two-phase decay over 6 hours
                    CASE
                        WHEN p.author_id = :uid
                             AND ({age_pg}) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - ({age_pg}) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid
                             AND ({age_pg}) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (({age_pg}) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                    END AS own_post_score,
                    -- recent engagement: boost recent posts with live reaction count
                    LEAST({RECENT_ENGAGEMENT_MAX},
                        LN(1
                            + COALESCE(p.comments_count, 0) * 2
                            + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                        )
                        * GREATEST(0, 1.0 - ({age_pg}) / {RECENT_ENGAGEMENT_WINDOW}.0)
                    ) AS recent_engagement_score,
                    -- user reaction: boost posts the user has reacted to
                    CASE WHEN er_user.id IS NOT NULL THEN {USER_REACTION_BOOST} ELSE 0 END
                        AS user_reaction_score,
                    -- discovery: boost high-engagement image posts from unfollowed users
                    CASE
                        WHEN f_out.id IS NULL AND f_in.id IS NULL AND p.author_id != :uid
                             AND (COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                                  + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                                  + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}) >= {DISCOVERY_ENGAGEMENT_THRESHOLD}
                             AND {self._image_predicate()}
                        THEN {DISCOVERY_BOOST}
                        ELSE 0
                    END AS discovery_score,
                    {filter_clauses["boost_expr"]} AS filter_boost_score,
                    -- jitter: deterministic randomness based on post id + query time
                    ({JITTER_MAX} * (
                        (('x' || SUBSTR(MD5(p.id || ({age_pg})::text), 1, 8))::bit(32)::int
                        & 65535) / 65535.0
                    ) - {JITTER_MAX / 2}) AS jitter_score,

                    -- feed_score: sum of all components
                    ({RECENCY_MAX} * GREATEST(0, 1.0 - ({age_pg}) / {RECENCY_WINDOW_SECONDS}.0))
                    + LEAST({COMBINED_ENGAGEMENT_MAX},
                        LEAST({ENGAGEMENT_MAX}, LN(1
                            + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                            + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                            + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}
                        ))
                        + LEAST({DIVERSITY_BONUS_MAX_TYPES},
                            (SELECT COUNT(DISTINCT emoji_code) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                          ) * {DIVERSITY_BONUS_PER_TYPE}
                        + LEAST({RECENT_ENGAGEMENT_MAX},
                            LN(1
                                + COALESCE(p.comments_count, 0) * 2
                                + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                            )
                            * GREATEST(0, 1.0 - ({age_pg}) / {RECENT_ENGAGEMENT_WINDOW}.0)
                        )
                    )
                    + CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                      END
                      * GREATEST(0, 1.0 - ({age_pg}) / {RECENCY_WINDOW_SECONDS}.0)
                    + CASE
                        WHEN p.author_id = :uid
                             AND ({age_pg}) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - ({age_pg}) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid
                             AND ({age_pg}) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (({age_pg}) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                      END
                    + CASE WHEN er_user.id IS NOT NULL THEN {USER_REACTION_BOOST} ELSE 0 END
                    + CASE
                        WHEN f_out.id IS NULL AND f_in.id IS NULL AND p.author_id != :uid
                             AND (COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                                  + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                                  + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}) >= {DISCOVERY_ENGAGEMENT_THRESHOLD}
                             AND {self._image_predicate()}
                        THEN {DISCOVERY_BOOST}
                        ELSE 0
                      END
                    + {filter_clauses["boost_expr"]}
                    + ({JITTER_MAX} * (
                        (('x' || SUBSTR(MD5(p.id || ({age_pg})::text), 1, 8))::bit(32)::int
                        & 65535) / 65535.0
                    ) - {JITTER_MAX / 2})
                    AS feed_score
                FROM posts p
                LEFT JOIN follows f_out
                    ON f_out.follower_id = :uid AND f_out.followed_id = p.author_id
                    AND f_out.status = 'active' AND p.author_id != :uid
                LEFT JOIN follows f_in
                    ON f_in.follower_id = p.author_id AND f_in.followed_id = :uid
                    AND f_in.status = 'active' AND p.author_id != :uid
                LEFT JOIN emoji_reactions er_user
                    ON er_user.post_id = p.id AND er_user.user_id = :uid AND er_user.object_type = 'post'
                WHERE p.deleted_at IS NULL
                  AND can_view_post(:uid, p.id::uuid)
                {filter_clauses["required_clause"]}
            )
            SELECT * FROM scored
            WHERE 1=1 {cursor_filter}
            ORDER BY feed_score DESC, created_at DESC, id DESC
            LIMIT :lim
        """)

        params = {"uid": user_id, "qt": query_time, "lim": page_size}
        params.update(filter_clauses.get("params", {}))
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
        filter_spec: Dict[str, Any],
    ) -> Tuple[Any, Dict]:
        """SQLite query for tests. Uses julianday for time math, LN/GREATEST registered as custom functions."""

        cursor_filter = ""
        if cursor_data:
            cursor_filter = (
                "AND (feed_score, created_at, id) < (:cursor_s, :cursor_t, :cursor_id)"
            )

        age_expr = f"(julianday(:qt) - julianday(p.created_at)) * 86400"
        filter_clauses = self._build_filter_clauses(filter_spec, "sqlite")
        logger.info(
            "[FEED_FILTERS][sql] dialect=sqlite filters=%s required_clause=%s boost_count=%s",
            filter_spec["debug"],
            filter_clauses["required_clause"] or "(none)",
            len(filter_clauses["boost_predicates"]),
        )
        # Build visibility clause for SQLite (inline instead of can_view_post function)
        visibility_clause = """
            p.deleted_at IS NULL
            AND (
                p.author_id = :uid
                OR p.privacy_level = 'public'
                OR (
                    p.privacy_level = 'custom'
                    AND (
                        (
                            EXISTS (
                                SELECT 1
                                FROM post_privacy_rules ppr
                                WHERE ppr.post_id = p.id
                                  AND ppr.rule_type = 'followers'
                            )
                            AND EXISTS (
                                SELECT 1
                                FROM follows vf
                                WHERE vf.follower_id = :uid
                                  AND vf.followed_id = p.author_id
                                  AND vf.status = 'active'
                            )
                        )
                        OR (
                            EXISTS (
                                SELECT 1
                                FROM post_privacy_rules ppr
                                WHERE ppr.post_id = p.id
                                  AND ppr.rule_type = 'following'
                            )
                            AND EXISTS (
                                SELECT 1
                                FROM follows af
                                WHERE af.follower_id = p.author_id
                                  AND af.followed_id = :uid
                                  AND af.status = 'active'
                            )
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM post_privacy_users ppu
                            WHERE ppu.post_id = p.id
                              AND ppu.user_id = :uid
                        )
                    )
                )
            )
        """
        # Deterministic jitter for SQLite: lightweight hash from UUID chars + query time
        jitter_sqlite = f"""
            ({JITTER_MAX} * (
                (ABS(UNICODE(SUBSTR(p.id, 1, 1)) * 31
                     + UNICODE(SUBSTR(p.id, 10, 1)) * 17
                     + UNICODE(SUBSTR(p.id, 20, 1)) * 13
                     + CAST(julianday(:qt) * 1000 AS INTEGER)
                ) % 1000) / 1000.0
            ) - {JITTER_MAX / 2})
        """

        sql = text(f"""
            WITH scored AS (
                SELECT p.*,
                    -- recency: 10 -> 0 over 7 days
                    ({RECENCY_MAX} * GREATEST(0, 1.0 - ({age_expr}) / {RECENCY_WINDOW_SECONDS}.0))
                        AS recency_score,
                    -- engagement: log-scaled, capped; all reactions weighted equally
                    LEAST({ENGAGEMENT_MAX}, LN(1
                        + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                        + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                        + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}
                    )) AS engagement_score,
                    -- diversity bonus: +{DIVERSITY_BONUS_PER_TYPE} per unique emoji type, capped at {DIVERSITY_BONUS_MAX_TYPES} types
                    LEAST({DIVERSITY_BONUS_MAX_TYPES},
                        (SELECT COUNT(DISTINCT emoji_code) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                    ) * {DIVERSITY_BONUS_PER_TYPE} AS diversity_bonus_score,
                    -- relationship: scaled by recency so it fades with age
                    CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                    END
                    * GREATEST(0, 1.0 - ({age_expr}) / {RECENCY_WINDOW_SECONDS}.0)
                    AS relationship_score,
                    -- own-post boost: two-phase decay over 6 hours
                    CASE
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - ({age_expr}) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (({age_expr}) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                    END AS own_post_score,
                    -- recent engagement: boost recent posts with live reaction count
                    LEAST({RECENT_ENGAGEMENT_MAX},
                        LN(1
                            + COALESCE(p.comments_count, 0) * 2
                            + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                        )
                        * GREATEST(0, 1.0 - ({age_expr}) / {RECENT_ENGAGEMENT_WINDOW}.0)
                    ) AS recent_engagement_score,
                    -- user reaction: boost posts the user has reacted to
                    CASE WHEN er_user.id IS NOT NULL THEN {USER_REACTION_BOOST} ELSE 0 END
                        AS user_reaction_score,
                    -- discovery: boost high-engagement image posts from unfollowed users
                    CASE
                        WHEN f_out.id IS NULL AND f_in.id IS NULL AND p.author_id != :uid
                             AND (COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                                  + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                                  + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}) >= {DISCOVERY_ENGAGEMENT_THRESHOLD}
                             AND {self._image_predicate()}
                        THEN {DISCOVERY_BOOST}
                        ELSE 0
                    END AS discovery_score,
                    {filter_clauses["boost_expr"]} AS filter_boost_score,
                    -- jitter: deterministic randomness
                    ({jitter_sqlite}) AS jitter_score,

                    -- feed_score: sum of all components
                    ({RECENCY_MAX} * GREATEST(0, 1.0 - ({age_expr}) / {RECENCY_WINDOW_SECONDS}.0))
                    + LEAST({COMBINED_ENGAGEMENT_MAX},
                        LEAST({ENGAGEMENT_MAX}, LN(1
                            + COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                            + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                            + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}
                        ))
                        + LEAST({DIVERSITY_BONUS_MAX_TYPES},
                            (SELECT COUNT(DISTINCT emoji_code) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                          ) * {DIVERSITY_BONUS_PER_TYPE}
                        + LEAST({RECENT_ENGAGEMENT_MAX},
                            LN(1
                                + COALESCE(p.comments_count, 0) * 2
                                + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post')
                            )
                            * GREATEST(0, 1.0 - ({age_expr}) / {RECENT_ENGAGEMENT_WINDOW}.0)
                        )
                    )
                    + CASE
                        WHEN p.author_id = :uid THEN 0
                        WHEN f_out.id IS NOT NULL AND f_in.id IS NOT NULL THEN {RELATIONSHIP_MUTUAL}
                        WHEN f_out.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWING}
                        WHEN f_in.id IS NOT NULL THEN {RELATIONSHIP_FOLLOWED_BY}
                        ELSE 0
                      END
                      * GREATEST(0, 1.0 - ({age_expr}) / {RECENCY_WINDOW_SECONDS}.0)
                    + CASE
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS}
                        THEN {OWN_POST_PHASE1_MAX} * GREATEST(0, 1.0 - ({age_expr}) / {OWN_POST_PHASE1_SECONDS}.0)
                        WHEN p.author_id = :uid AND ({age_expr}) <= {OWN_POST_PHASE1_SECONDS + OWN_POST_PHASE2_SECONDS}
                        THEN {OWN_POST_PHASE2_MAX} * GREATEST(0, 1.0 - (({age_expr}) - {OWN_POST_PHASE1_SECONDS}.0) / {OWN_POST_PHASE2_SECONDS}.0)
                        ELSE 0
                      END
                    + CASE WHEN er_user.id IS NOT NULL THEN {USER_REACTION_BOOST} ELSE 0 END
                    + CASE
                        WHEN f_out.id IS NULL AND f_in.id IS NULL AND p.author_id != :uid
                             AND (COALESCE(p.comments_count, 0) * {WEIGHT_COMMENTS}
                                  + COALESCE(p.shares_count, 0) * {WEIGHT_SHARES}
                                  + (SELECT COUNT(DISTINCT user_id) FROM emoji_reactions WHERE post_id = p.id AND object_type = 'post') * {WEIGHT_REACTIONS}) >= {DISCOVERY_ENGAGEMENT_THRESHOLD}
                             AND {self._image_predicate()}
                        THEN {DISCOVERY_BOOST}
                        ELSE 0
                      END
                    + {filter_clauses["boost_expr"]}
                    + ({jitter_sqlite})
                    AS feed_score
                FROM posts p
                LEFT JOIN follows f_out
                    ON f_out.follower_id = :uid AND f_out.followed_id = p.author_id
                    AND f_out.status = 'active' AND p.author_id != :uid
                LEFT JOIN follows f_in
                    ON f_in.follower_id = p.author_id AND f_in.followed_id = :uid
                    AND f_in.status = 'active' AND p.author_id != :uid
                LEFT JOIN emoji_reactions er_user
                    ON er_user.post_id = p.id AND er_user.user_id = :uid AND er_user.object_type = 'post'
                WHERE {visibility_clause}
                {filter_clauses["required_clause"]}
            )
            SELECT * FROM scored
            WHERE 1=1 {cursor_filter}
            ORDER BY feed_score DESC, created_at DESC, id DESC
            LIMIT :lim
        """)

        params: Dict[str, Any] = {
            "uid": user_id,
            "qt": query_time.isoformat(),
            "lim": page_size,
        }
        params.update(filter_clauses.get("params", {}))
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
        posts: List[Post],
        max_per_window: int = AUTHOR_SPACING_MAX_PER_WINDOW,
        window: int = AUTHOR_SPACING_WINDOW,
    ) -> List[Post]:
        """Reorder posts so no author appears more than max_per_window times in any window.

        Uses LRU preference: among valid candidates, prefer authors with the
        fewest recent appearances, breaking ties by original ordering.
        """
        if len(posts) <= 1:
            return posts

        result: List[Post] = []
        deferred: List[Post] = []
        remaining = list(posts)

        def _recent_count(author_id: int) -> int:
            return sum(1 for p in result[-window:] if p.author_id == author_id)

        def _pick_best(candidates: List[Post]) -> Optional[int]:
            """Return index of the candidate with lowest recent author count, or None."""
            best_idx = None
            best_count = max_per_window
            for i, post in enumerate(candidates):
                count = _recent_count(post.author_id)
                if count < best_count:
                    best_count = count
                    best_idx = i
            return best_idx

        while remaining or deferred:
            # Try remaining first — LRU pick among valid candidates
            pick = _pick_best(remaining)
            if pick is not None:
                result.append(remaining.pop(pick))
                continue

            # Remaining exhausted or all violate constraint — try deferred
            pick = _pick_best(deferred)
            if pick is not None:
                result.append(deferred.pop(pick))
                continue

            # No valid candidate anywhere — check if remaining has posts to defer
            if remaining:
                deferred.append(remaining.pop(0))
                continue

            # All remaining posts violate constraint — force place to avoid infinite loop
            if deferred:
                result.append(deferred.pop(0))

        return result

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
