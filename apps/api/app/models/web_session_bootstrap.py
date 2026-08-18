"""
Single-use bootstrap records that transfer a native app session into the
Social WebView session (SW2-P2).

Only the salted SHA-256 hash of the opaque bootstrap token is stored; the raw
token is never persisted, logged, or returned a second time. Records are
single-use (consumed_at), short-lived (expires_at = now + 300s), bound to a
user (user_id) and to the configured web origin (audience).
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class WebSessionBootstrap(Base):
    """Internal-only, single-use native -> WebView session bootstrap record."""

    __tablename__ = "web_session_bootstraps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    purpose = Column(String(32), nullable=False, default="web_session")
    audience = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="web_session_bootstraps")

    __table_args__ = (
        Index("ix_web_session_bootstraps_user_created", "user_id", "created_at"),
    )
