"""
User model.
"""

from typing import Dict, Any
from sqlalchemy import Column, Integer, String, DateTime, func, Text, JSON
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
    
    # Enhanced profile fields
    display_name = Column(String(100), nullable=True, index=True)
    city = Column(String(100), nullable=True, index=True)
    institutions = Column(JSON, nullable=True)
    websites = Column(JSON, nullable=True)
    location = Column(JSON, nullable=True)  # For structured location data from Nominatim
    profile_photo_filename = Column(String(255), nullable=True, index=True)
    profile_preferences = Column(JSON, nullable=True)
    
    # Feed refresh mechanism
    last_feed_view = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # OAuth fields
    oauth_provider = Column(String(50), nullable=True, index=True)  # 'google', 'facebook', etc.
    oauth_id = Column(String(255), nullable=True, index=True)  # Provider-specific user ID
    oauth_data = Column(JSON, nullable=True)  # Additional OAuth data (profile info, etc.)

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

    @classmethod
    async def get_by_oauth(cls, db: AsyncSession, provider: str, oauth_id: str):
        """Get user by OAuth provider and ID."""
        result = await db.execute(
            select(cls).where(
                cls.oauth_provider == provider,
                cls.oauth_id == oauth_id
            )
        )
        return result.scalar_one_or_none()
    
    @classmethod
    async def check_oauth_conflicts(cls, db: AsyncSession, email: str, provider: str, oauth_id: str) -> Dict[str, Any]:
        """
        Check for OAuth account conflicts before linking.
        
        Args:
            db: Database session
            email: Email address from OAuth provider
            provider: OAuth provider name
            oauth_id: OAuth user ID from provider
            
        Returns:
            Dictionary with conflict information
        """
        conflicts = {
            'email_exists': False,
            'oauth_exists': False,
            'same_oauth_account': False,
            'different_provider': False,
            'existing_user_id': None,
            'existing_provider': None
        }
        
        # Check if email exists
        email_user = await cls.get_by_email(db, email)
        if email_user:
            conflicts['email_exists'] = True
            conflicts['existing_user_id'] = email_user.id
            
            # Check OAuth status of email user
            if email_user.oauth_provider and email_user.oauth_id:
                conflicts['oauth_exists'] = True
                conflicts['existing_provider'] = email_user.oauth_provider
                
                if email_user.oauth_provider == provider and email_user.oauth_id == oauth_id:
                    conflicts['same_oauth_account'] = True
                else:
                    conflicts['different_provider'] = True
        
        # Check if OAuth account exists with different email
        oauth_user = await cls.get_by_oauth(db, provider, oauth_id)
        if oauth_user and oauth_user.email != email:
            conflicts['oauth_exists'] = True
            conflicts['existing_user_id'] = oauth_user.id
        
        return conflicts

    @classmethod
    async def get_by_email_or_oauth(cls, db: AsyncSession, email: str, provider: str = None, oauth_id: str = None):
        """Get user by email or OAuth credentials."""
        if provider and oauth_id:
            # Try OAuth first
            user = await cls.get_by_oauth(db, provider, oauth_id)
            if user:
                return user
        
        # Fall back to email
        return await cls.get_by_email(db, email) 

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
    
    # User interaction relationships for preference tracking
    interactions_given = relationship(
        "UserInteraction",
        foreign_keys="UserInteraction.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    interactions_received = relationship(
        "UserInteraction",
        foreign_keys="UserInteraction.target_user_id", 
        back_populates="target_user",
        cascade="all, delete-orphan"
    )