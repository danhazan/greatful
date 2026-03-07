"""
Post privacy models for custom visibility rules.
"""

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Integer,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class PostPrivacyRule(Base):
    """
    Per-post rule toggles for custom privacy evaluation.

    Example rule_type values:
    - followers
    - following
    - specific_users
    """

    __tablename__ = "post_privacy_rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    rule_type = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("post_id", "rule_type", name="unique_post_privacy_rule"),
    )

    post = relationship("Post", back_populates="privacy_rules")


class PostPrivacyUser(Base):
    """
    Explicit per-post allow-list for selected users.
    """

    __tablename__ = "post_privacy_users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="unique_post_privacy_user"),
    )

    post = relationship("Post", back_populates="privacy_users")
    user = relationship("User")

