"""
Internal recovery-compatible identity records for deleted users.

These rows are internal-only and must never be exposed in public APIs, profile
responses, search, exports, or serializers. They preserve just enough linkage
for future account recovery/reactivation work.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DeletedUserAuthIdentity(Base):
    """Internal-only identity metadata for tombstoned users."""

    __tablename__ = "deleted_user_auth_identities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    identity_type = Column(String(50), nullable=False)
    provider = Column(String(50), nullable=True)
    provider_user_id = Column(String(255), nullable=True)
    email_hash = Column(String(128), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="deleted_auth_identities")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "identity_type",
            "provider",
            "provider_user_id",
            name="uq_deleted_user_identity",
        ),
        Index("idx_deleted_user_identity_provider", "provider", "provider_user_id"),
    )
