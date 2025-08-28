"""
MentionService for handling @username mentions business logic using repository pattern.
"""

import re
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, BusinessLogicError
from app.core.query_monitor import monitor_query
from app.repositories.mention_repository import MentionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.post_repository import PostRepository
from app.models.mention import Mention
from app.models.user import User
from app.models.post import Post
from app.services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class MentionService(BaseService):
    """Service for managing @username mentions using repository pattern."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.mention_repo = MentionRepository(db)
        self.user_repo = UserRepository(db)
        self.post_repo = PostRepository(db)

    # Regex pattern for extracting @username mentions
    MENTION_PATTERN = re.compile(r'@([a-zA-Z0-9_]+)')

    @monitor_query("extract_mentions")
    async def extract_mentions(self, content: str) -> List[str]:
        """
        Extract @username mentions from text content.
        
        Args:
            content: Text content to parse for mentions
            
        Returns:
            List[str]: List of unique usernames mentioned (without @)
        """
        if not content:
            return []
        
        # Find all @username patterns
        matches = self.MENTION_PATTERN.findall(content)
        
        # Remove duplicates and return
        unique_mentions = list(set(matches))
        
        logger.info(f"Extracted {len(unique_mentions)} unique mentions from content")
        return unique_mentions

    @monitor_query("validate_mentions")
    async def validate_mentions(self, usernames: List[str]) -> List[User]:
        """
        Validate that mentioned usernames exist and return User objects.
        
        Args:
            usernames: List of usernames to validate
            
        Returns:
            List[User]: List of valid User objects
        """
        if not usernames:
            return []
        
        valid_users = []
        
        for username in usernames:
            user = await self.user_repo.get_by_username(username)
            if user:
                valid_users.append(user)
            else:
                logger.warning(f"Mentioned username not found: {username}")
        
        logger.info(f"Validated {len(valid_users)} out of {len(usernames)} mentioned users")
        return valid_users

    @monitor_query("create_mentions")
    async def create_mentions(
        self, 
        post_id: str, 
        author_id: int, 
        content: str
    ) -> List[Dict[str, Any]]:
        """
        Extract mentions from content and create mention records.
        
        Args:
            post_id: ID of the post containing mentions
            author_id: ID of the post author
            content: Post content to parse for mentions
            
        Returns:
            List[Dict]: List of created mention dictionaries
            
        Raises:
            NotFoundError: If post doesn't exist
        """
        # Verify post exists
        post = await self.post_repo.get_by_id_or_404(post_id)
        
        # Extract usernames from content
        usernames = await self.extract_mentions(content)
        
        if not usernames:
            return []
        
        # Validate mentioned users exist
        valid_users = await self.validate_mentions(usernames)
        
        if not valid_users:
            return []
        
        # Filter out self-mentions (author mentioning themselves)
        valid_users = [user for user in valid_users if user.id != author_id]
        
        if not valid_users:
            logger.info("No valid mentions after filtering self-mentions")
            return []
        
        # Create mention records
        mentioned_user_ids = [user.id for user in valid_users]
        mentions = await self.mention_repo.bulk_create_mentions(
            post_id=post_id,
            author_id=author_id,
            mentioned_user_ids=mentioned_user_ids
        )
        
        # Create notifications for mentioned users
        author = await self.user_repo.get_by_id_or_404(author_id)
        
        for user in valid_users:
            try:
                await NotificationService.create_mention_notification(
                    db=self.db,
                    mentioned_user_id=user.id,
                    author_username=author.username,
                    post_id=post_id,
                    post_preview=content[:100] + "..." if len(content) > 100 else content
                )
            except Exception as e:
                logger.error(f"Failed to create mention notification for user {user.id}: {e}")
                # Don't fail the mention creation if notification fails
        
        logger.info(f"Created {len(mentions)} mentions for post {post_id}")
        
        # Return mention data
        return [
            {
                "id": mention.id,
                "post_id": mention.post_id,
                "author_id": mention.author_id,
                "mentioned_user_id": mention.mentioned_user_id,
                "created_at": mention.created_at.isoformat(),
                "mentioned_user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": user.profile_image_url
                }
            }
            for mention, user in zip(mentions, valid_users)
        ]

    @monitor_query("search_users")
    async def search_users(
        self, 
        query: str, 
        limit: int = 10,
        exclude_user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Search users by username for mention autocomplete.
        
        Args:
            query: Search query (partial username)
            limit: Maximum number of results
            exclude_user_id: Optional user ID to exclude from results
            
        Returns:
            List[Dict]: List of user dictionaries for autocomplete
        """
        if not query:
            return []
        
        # Clean the query - remove @ if present
        clean_query = query.lstrip('@').strip()
        
        # Validate minimum query length
        if len(clean_query) < 1:
            return []
        
        # Search users by username
        exclude_user_ids = [exclude_user_id] if exclude_user_id else None
        users = await self.user_repo.search_by_username(
            query=clean_query,
            limit=limit,
            exclude_user_ids=exclude_user_ids
        )
        
        # Format for autocomplete
        results = [
            {
                "id": user.id,
                "username": user.username,
                "profile_image_url": user.profile_image_url,
                "bio": user.bio
            }
            for user in users
        ]
        
        logger.info(f"Found {len(results)} users matching query: {clean_query}")
        return results

    @monitor_query("get_post_mentions")
    async def get_post_mentions(self, post_id: str) -> List[Dict[str, Any]]:
        """
        Get all mentions for a specific post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            List[Dict]: List of mention dictionaries with user data
        """
        mentions = await self.mention_repo.get_post_mentions(post_id, load_users=True)
        
        return [
            {
                "id": mention.id,
                "post_id": mention.post_id,
                "author_id": mention.author_id,
                "mentioned_user_id": mention.mentioned_user_id,
                "created_at": mention.created_at.isoformat(),
                "author": {
                    "id": mention.author.id,
                    "username": mention.author.username,
                    "profile_image_url": mention.author.profile_image_url
                },
                "mentioned_user": {
                    "id": mention.mentioned_user.id,
                    "username": mention.mentioned_user.username,
                    "profile_image_url": mention.mentioned_user.profile_image_url
                }
            }
            for mention in mentions
        ]

    @monitor_query("get_user_mentions")
    async def get_user_mentions(
        self, 
        user_id: int, 
        limit: int = 20, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get mentions received by a specific user.
        
        Args:
            user_id: ID of the mentioned user
            limit: Maximum number of mentions
            offset: Number of mentions to skip
            
        Returns:
            List[Dict]: List of mention dictionaries with post and author data
        """
        mentions = await self.mention_repo.get_user_mentions(
            user_id=user_id,
            limit=limit,
            offset=offset,
            load_relationships=True
        )
        
        return [
            {
                "id": mention.id,
                "post_id": mention.post_id,
                "author_id": mention.author_id,
                "mentioned_user_id": mention.mentioned_user_id,
                "created_at": mention.created_at.isoformat(),
                "author": {
                    "id": mention.author.id,
                    "username": mention.author.username,
                    "profile_image_url": mention.author.profile_image_url
                },
                "post": {
                    "id": mention.post.id,
                    "content": mention.post.content[:100] + "..." if len(mention.post.content) > 100 else mention.post.content,
                    "post_type": mention.post.post_type,
                    "created_at": mention.post.created_at.isoformat()
                }
            }
            for mention in mentions
        ]

    async def validate_mention_permissions(
        self, 
        author_id: int, 
        mentioned_user_id: int
    ) -> bool:
        """
        Validate if a user can mention another user (privacy/blocking checks).
        
        Args:
            author_id: ID of the user creating the mention
            mentioned_user_id: ID of the user being mentioned
            
        Returns:
            bool: True if mention is allowed, False otherwise
        """
        # For now, allow all mentions (privacy controls can be added later)
        # Future implementation could check:
        # - User privacy settings (allow_mentions)
        # - Blocking relationships
        # - Follow relationships for private accounts
        
        # Don't allow self-mentions
        if author_id == mentioned_user_id:
            return False
        
        # Verify both users exist
        author = await self.user_repo.get_by_id(author_id)
        mentioned_user = await self.user_repo.get_by_id(mentioned_user_id)
        
        if not author or not mentioned_user:
            return False
        
        logger.info(f"Mention permission validated: {author_id} -> {mentioned_user_id}")
        return True

    @monitor_query("get_recent_mentioners")
    async def get_recent_mentioners(
        self, 
        user_id: int, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get users who recently mentioned the specified user.
        
        Args:
            user_id: ID of the mentioned user
            limit: Maximum number of recent mentioners
            
        Returns:
            List[Dict]: List of recent mentioner information
        """
        return await self.mention_repo.get_recent_mentioners(user_id, limit)

    @monitor_query("get_mention_analytics")
    async def get_mention_analytics(
        self, 
        user_id: Optional[int] = None, 
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get mention analytics for a user or globally.
        
        Args:
            user_id: Optional user ID to filter by
            days: Number of days to look back
            
        Returns:
            Dict: Analytics data
        """
        return await self.mention_repo.get_mention_analytics(user_id, days)

    async def highlight_mentions(self, content: str) -> str:
        """
        Add HTML highlighting to @username mentions in content.
        
        Args:
            content: Text content with mentions
            
        Returns:
            str: Content with highlighted mentions
        """
        if not content:
            return content
        
        def replace_mention(match):
            username = match.group(1)
            return f'<span class="mention">@{username}</span>'
        
        highlighted_content = self.MENTION_PATTERN.sub(replace_mention, content)
        return highlighted_content

    async def remove_post_mentions(self, post_id: str) -> int:
        """
        Remove all mentions for a specific post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Number of mentions removed
        """
        count = await self.mention_repo.delete_post_mentions(post_id)
        logger.info(f"Removed {count} mentions for post {post_id}")
        return count