"""
Share model for handling post sharing functionality.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ARRAY
from app.core.database import Base
import uuid
import enum
import json
import os

class ShareMethod(str, enum.Enum):
    url = "url"
    message = "message"

class Share(Base):
    """
    Share model for storing post sharing data.
    
    Supports two sharing methods:
    - 'url': Direct URL sharing (copy link)
    - 'message': In-app message sharing with recipients
    """
    __tablename__ = "shares"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    share_method = Column(String(20), nullable=False)  # 'url' or 'message'
    # Use ARRAY for PostgreSQL, Text for SQLite (tests)
    recipient_user_ids = Column(
        ARRAY(Integer) if os.getenv("DATABASE_URL", "").startswith("postgresql") else Text, 
        nullable=True, 
        default=None
    )  # Array of user IDs for message shares (PostgreSQL) or JSON string (SQLite)
    message_content = Column(Text, nullable=True)  # Optional message with share
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Share(id={self.id}, user_id={self.user_id}, post_id={self.post_id}, method={self.share_method})>"

    @classmethod
    def is_valid_share_method(cls, method: str) -> bool:
        """Check if the share method is valid."""
        return method in [ShareMethod.url.value, ShareMethod.message.value]

    @property
    def is_url_share(self) -> bool:
        """Check if this is a URL share."""
        return self.share_method == ShareMethod.url.value

    @property
    def is_message_share(self) -> bool:
        """Check if this is a message share."""
        return self.share_method == ShareMethod.message.value

    @property
    def recipient_ids_list(self) -> list:
        """Get recipient user IDs as a list."""
        if self.recipient_user_ids:
            # Handle both PostgreSQL ARRAY and SQLite JSON string
            if isinstance(self.recipient_user_ids, list):
                return list(self.recipient_user_ids)
            else:
                try:
                    return json.loads(self.recipient_user_ids)
                except (json.JSONDecodeError, TypeError):
                    return []
        return []
    
    @recipient_ids_list.setter
    def recipient_ids_list(self, value: list):
        """Set recipient user IDs from a list."""
        if value:
            # For PostgreSQL, store as array; for SQLite, store as JSON string
            if os.getenv("DATABASE_URL", "").startswith("postgresql"):
                self.recipient_user_ids = value
            else:
                self.recipient_user_ids = json.dumps(value)
        else:
            self.recipient_user_ids = None

    @property
    def recipient_count(self) -> int:
        """Get the number of recipients for message shares."""
        return len(self.recipient_ids_list)

    # Relationships
    user = relationship("User", backref="shares")
    post = relationship("Post", backref="shares")