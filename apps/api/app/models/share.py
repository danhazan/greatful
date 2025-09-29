"""
Share model for handling post sharing functionality.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects import postgresql
from app.core.database import Base
import uuid
import enum
import json
import os

class ShareMethod(str, enum.Enum):
    url = "url"
    message = "message"
    whatsapp = "whatsapp"

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
    # JSON/JSONB column for cross-dialect compatibility
    # NULL for URL shares, JSON array for message shares
    recipient_user_ids = Column(
        JSON().with_variant(postgresql.JSONB, "postgresql"), 
        nullable=True
    )
    message_content = Column(Text, nullable=True)  # Optional message with share
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __init__(self, **kwargs):
        # Handle recipient_user_ids properly for PostgreSQL arrays
        if 'recipient_user_ids' in kwargs and kwargs['recipient_user_ids'] is None:
            # For PostgreSQL arrays, None should be None, not converted to string
            if os.getenv("DATABASE_URL", "").startswith("postgresql"):
                kwargs['recipient_user_ids'] = None
            else:
                # For SQLite, keep as None
                kwargs['recipient_user_ids'] = None
        super().__init__(**kwargs)

    def __repr__(self):
        return f"<Share(id={self.id}, user_id={self.user_id}, post_id={self.post_id}, method={self.share_method})>"

    @classmethod
    def is_valid_share_method(cls, method: str) -> bool:
        """Check if the share method is valid."""
        return method in [ShareMethod.url.value, ShareMethod.message.value, ShareMethod.whatsapp.value]

    @property
    def is_url_share(self) -> bool:
        """Check if this is a URL share."""
        return self.share_method == ShareMethod.url.value

    @property
    def is_message_share(self) -> bool:
        """Check if this is a message share."""
        return self.share_method == ShareMethod.message.value

    @property
    def is_whatsapp_share(self) -> bool:
        """Check if this is a WhatsApp share."""
        return self.share_method == ShareMethod.whatsapp.value

    @property
    def recipient_ids_list(self) -> list:
        """Get recipient user IDs as a list."""
        if self.recipient_user_ids:
            # recipient_user_ids is now stored as JSON/JSONB directly
            if isinstance(self.recipient_user_ids, list):
                return self.recipient_user_ids
            else:
                # Fallback for any string data during migration
                try:
                    return json.loads(self.recipient_user_ids)
                except (json.JSONDecodeError, TypeError):
                    return []
        return []
    
    @recipient_ids_list.setter
    def recipient_ids_list(self, value: list):
        """Set recipient user IDs from a list."""
        if value:
            # Store directly as JSON (SQLAlchemy handles serialization)
            self.recipient_user_ids = value
        else:
            self.recipient_user_ids = None

    @property
    def recipient_count(self) -> int:
        """Get the number of recipients for message shares."""
        return len(self.recipient_ids_list)

    # Relationships
    user = relationship("User", backref="shares")
    post = relationship("Post", backref="shares")