"""
User model.
"""

from sqlalchemy import Column, Integer, String, DateTime, func, Text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import Base
from sqlalchemy.orm import relationship

class User(Base):
    """User model."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    bio = Column(Text, nullable=True)
    profile_image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    @classmethod
    async def get_by_email(cls, db: AsyncSession, email: str):
        """Get user by email."""
        result = await db.execute(select(cls).where(cls.email == email))
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_id(cls, db: AsyncSession, user_id: int):
        """Get user by ID."""
        result = await db.execute(select(cls).where(cls.id == user_id))
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_username(cls, db: AsyncSession, username: str):
        """Get user by username."""
        result = await db.execute(select(cls).where(cls.username == username))
        return result.scalar_one_or_none() 

    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    # Follow relationships - users this user is following
    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
        overlaps="following_relationships"
    )
    
    # Follow relationships - users following this user
    followers = relationship(
        "Follow", 
        foreign_keys="Follow.followed_id",
        back_populates="followed",
        cascade="all, delete-orphan",
        overlaps="follower_relationships"
    )