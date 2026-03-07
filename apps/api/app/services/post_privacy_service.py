"""
Post privacy service for validation, persistence, and visibility filtering.

Architecture:
- PostgreSQL: visibility filtering can use the `can_view_post(viewer_id, post_id)`
  database function to keep query predicates concise and reusable.
- SQLite (tests): fallback to the existing SQLAlchemy clause builder so tests run
  without PostgreSQL-only function dependencies.
"""

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional
import logging
import uuid
from sqlalchemy import and_, cast, delete, exists, func, or_, select
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow import Follow
from app.models.post import Post, PostPrivacyLevel
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser

logger = logging.getLogger(__name__)


@dataclass
class PostPrivacyConfig:
    level: str
    rules: List[str]
    specific_user_ids: List[int]

    @property
    def is_public(self) -> bool:
        return self.level == PostPrivacyLevel.public.value


class PostPrivacyService:
    PUBLIC = PostPrivacyLevel.public.value
    PRIVATE = PostPrivacyLevel.private.value
    CUSTOM = PostPrivacyLevel.custom.value

    RULE_FOLLOWERS = "followers"
    RULE_FOLLOWING = "following"
    RULE_SPECIFIC_USERS = "specific_users"

    SUPPORTED_LEVELS = {PUBLIC, PRIVATE, CUSTOM}
    SUPPORTED_RULES = {RULE_FOLLOWERS, RULE_FOLLOWING, RULE_SPECIFIC_USERS}

    def __init__(self, db: AsyncSession):
        self.db = db

    @classmethod
    def resolve_config(
        cls,
        *,
        privacy_level: Optional[str] = None,
        rules: Optional[Iterable[str]] = None,
        specific_users: Optional[Iterable[int]] = None,
        is_public: Optional[bool] = None,
        author_id: Optional[int] = None,
    ) -> PostPrivacyConfig:
        logger.debug(
            "[PRIVACY][resolve_config][input] privacy_level=%s rules=%s specific_users=%s author_id=%s is_public=%s",
            privacy_level,
            list(rules or []),
            list(specific_users or []),
            author_id,
            is_public,
        )

        level = (privacy_level or "").strip().lower()
        if not level:
            level = cls.PUBLIC if is_public is not False else cls.PRIVATE

        if level not in cls.SUPPORTED_LEVELS:
            raise ValueError(
                f"Invalid privacy_level '{level}'. Expected one of: {sorted(cls.SUPPORTED_LEVELS)}"
            )

        normalized_rules: List[str] = []
        for rule in list(rules or []):
            normalized = str(rule).strip().lower()
            if not normalized:
                continue
            if normalized not in cls.SUPPORTED_RULES:
                raise ValueError(
                    f"Invalid privacy rule '{normalized}'. Expected one of: {sorted(cls.SUPPORTED_RULES)}"
                )
            if normalized not in normalized_rules:
                normalized_rules.append(normalized)

        specific_user_ids: List[int] = []
        for user_id in list(specific_users or []):
            try:
                parsed = int(user_id)
            except (TypeError, ValueError):
                raise ValueError(f"Invalid specific user id '{user_id}'") from None
            if parsed <= 0:
                continue
            if author_id is not None and parsed == author_id:
                continue
            if parsed not in specific_user_ids:
                specific_user_ids.append(parsed)

        if level != cls.CUSTOM:
            logger.debug(
                "[PRIVACY][resolve_config][normalized] level=%s normalized_rules=%s normalized_specific_user_ids=%s",
                level,
                [],
                [],
            )
            return PostPrivacyConfig(level=level, rules=[], specific_user_ids=[])

        # Specific users are stored in a dedicated table but still represented as a rule.
        if specific_user_ids and cls.RULE_SPECIFIC_USERS not in normalized_rules:
            normalized_rules.append(cls.RULE_SPECIFIC_USERS)
        if not specific_user_ids and cls.RULE_SPECIFIC_USERS in normalized_rules:
            normalized_rules = [r for r in normalized_rules if r != cls.RULE_SPECIFIC_USERS]

        if not normalized_rules:
            raise ValueError(
                "Custom privacy requires at least one audience rule (followers, following, or specific_users)."
            )

        config = PostPrivacyConfig(
            level=level,
            rules=normalized_rules,
            specific_user_ids=specific_user_ids,
        )
        logger.debug(
            "[PRIVACY][resolve_config][normalized] level=%s normalized_rules=%s normalized_specific_user_ids=%s",
            config.level,
            config.rules,
            config.specific_user_ids,
        )
        return config

    async def apply_post_config(self, post: Post, config: PostPrivacyConfig) -> None:
        logger.debug(
            "[PRIVACY][apply_post_config] post_id=%s level=%s is_public=%s rules=%s specific_user_ids=%s",
            post.id,
            config.level,
            config.is_public,
            config.rules,
            config.specific_user_ids,
        )
        post.privacy_level = config.level
        # Backward compatibility for existing code paths and response contracts.
        post.is_public = config.is_public
        await self.replace_post_custom_rules(
            post_id=post.id,
            rules=config.rules,
            specific_user_ids=config.specific_user_ids,
        )

    async def replace_post_custom_rules(
        self,
        *,
        post_id: str,
        rules: Iterable[str],
        specific_user_ids: Iterable[int],
    ) -> None:
        await self.db.execute(delete(PostPrivacyRule).where(PostPrivacyRule.post_id == post_id))
        await self.db.execute(delete(PostPrivacyUser).where(PostPrivacyUser.post_id == post_id))

        for rule in list(rules):
            self.db.add(PostPrivacyRule(post_id=post_id, rule_type=rule))

        for user_id in list(specific_user_ids):
            self.db.add(PostPrivacyUser(post_id=post_id, user_id=user_id))

    @classmethod
    def public_visibility_clause(cls):
        # Legacy fallback for historical rows before privacy_level migration.
        return or_(
            Post.privacy_level == cls.PUBLIC,
            and_(Post.privacy_level.is_(None), Post.is_public.is_(True)),
        )

    @classmethod
    def visible_to_user_clause(cls, viewer_id: Optional[int]):
        logger.debug("[PRIVACY][visible_to_user_clause] viewer_id=%s", viewer_id)
        public_clause = cls.public_visibility_clause()

        if viewer_id is None:
            return public_clause

        followers_rule_enabled = exists(
            select(PostPrivacyRule.id).where(
                and_(
                    PostPrivacyRule.post_id == Post.id,
                    PostPrivacyRule.rule_type == cls.RULE_FOLLOWERS,
                )
            )
        )
        following_rule_enabled = exists(
            select(PostPrivacyRule.id).where(
                and_(
                    PostPrivacyRule.post_id == Post.id,
                    PostPrivacyRule.rule_type == cls.RULE_FOLLOWING,
                )
            )
        )
        viewer_in_specific_users = exists(
            select(PostPrivacyUser.id).where(
                and_(
                    PostPrivacyUser.post_id == Post.id,
                    PostPrivacyUser.user_id == viewer_id,
                )
            )
        )

        viewer_follows_author = exists(
            select(Follow.id).where(
                and_(
                    Follow.follower_id == viewer_id,
                    Follow.followed_id == Post.author_id,
                    Follow.status == "active",
                )
            )
        )
        author_follows_viewer = exists(
            select(Follow.id).where(
                and_(
                    Follow.follower_id == Post.author_id,
                    Follow.followed_id == viewer_id,
                    Follow.status == "active",
                )
            )
        )

        custom_clause = and_(
            Post.privacy_level == cls.CUSTOM,
            or_(
                and_(followers_rule_enabled, viewer_follows_author),
                and_(following_rule_enabled, author_follows_viewer),
                viewer_in_specific_users,
            ),
        )

        return or_(
            Post.author_id == viewer_id,
            public_clause,
            custom_clause,
        )

    @staticmethod
    def _dialect_name(db: AsyncSession) -> str:
        return db.bind.dialect.name if db.bind is not None else ""

    @classmethod
    def supports_db_visibility_function(cls, db: AsyncSession) -> bool:
        return cls._dialect_name(db) == "postgresql"

    @classmethod
    def visibility_filter_clause(cls, viewer_id: Optional[int], db: AsyncSession):
        if viewer_id is None:
            return cls.public_visibility_clause()
        if cls.supports_db_visibility_function(db):
            return func.can_view_post(viewer_id, cast(Post.id, PG_UUID))
        return cls.visible_to_user_clause(viewer_id)

    async def can_user_view_post(self, post_id: str, viewer_id: Optional[int]) -> bool:
        if viewer_id is None:
            result = await self.db.execute(
                select(Post.id).where(
                    and_(
                        Post.id == post_id,
                        self.public_visibility_clause(),
                    )
                ).limit(1)
            )
            return result.scalar_one_or_none() is not None

        if self.supports_db_visibility_function(self.db):
            try:
                post_uuid = uuid.UUID(str(post_id))
            except (TypeError, ValueError):
                return False
            result = await self.db.execute(select(func.can_view_post(viewer_id, post_uuid)))
            return bool(result.scalar())

        result = await self.db.execute(
            select(Post.id).where(
                and_(
                    Post.id == post_id,
                    self.visible_to_user_clause(viewer_id),
                )
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def get_privacy_details_for_posts(self, post_ids: Iterable[str]) -> Dict[str, Dict[str, List[int] | List[str]]]:
        ids = list(post_ids)
        if not ids:
            return {}

        rules_result = await self.db.execute(
            select(PostPrivacyRule.post_id, PostPrivacyRule.rule_type).where(
                PostPrivacyRule.post_id.in_(ids)
            )
        )
        users_result = await self.db.execute(
            select(PostPrivacyUser.post_id, PostPrivacyUser.user_id).where(
                PostPrivacyUser.post_id.in_(ids)
            )
        )

        data: Dict[str, Dict[str, List[int] | List[str]]] = {}
        for post_id, rule_type in rules_result.fetchall():
            if post_id not in data:
                data[post_id] = {"privacy_rules": [], "specific_users": []}
            rules = data[post_id]["privacy_rules"]
            if rule_type not in rules:
                rules.append(rule_type)

        for post_id, user_id in users_result.fetchall():
            if post_id not in data:
                data[post_id] = {"privacy_rules": [], "specific_users": []}
            users = data[post_id]["specific_users"]
            if user_id not in users:
                users.append(user_id)

        return data

    @classmethod
    def is_public_post(cls, post: Post) -> bool:
        if getattr(post, "privacy_level", None):
            return post.privacy_level == cls.PUBLIC
        return bool(getattr(post, "is_public", False))
