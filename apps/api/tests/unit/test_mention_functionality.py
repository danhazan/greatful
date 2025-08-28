"""
Unit tests for Mention model and MentionService functionality.
"""

import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.mention import Mention
from app.models.user import User
from app.models.post import Post
from app.services.mention_service import MentionService
from app.repositories.mention_repository import MentionRepository
from app.core.exceptions import NotFoundError, ValidationException


class TestMentionModel:
    """Test Mention model functionality."""
    
    def test_mention_model_creation(self):
        """Test basic mention model creation."""
        mention = Mention(
            post_id="test-post-id",
            author_id=1,
            mentioned_user_id=2
        )
        
        assert mention.post_id == "test-post-id"
        assert mention.author_id == 1
        assert mention.mentioned_user_id == 2
        # ID is generated when saved to database, so we just check the structure
    
    def test_mention_model_repr(self):
        """Test mention model string representation."""
        mention = Mention(
            post_id="test-post-id",
            author_id=1,
            mentioned_user_id=2
        )
        
        repr_str = repr(mention)
        assert "test-post-id" in repr_str
        assert "1" in repr_str
        assert "2" in repr_str


class TestMentionService:
    """Test MentionService functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mention_service(self, mock_db):
        """Create MentionService instance with mocked dependencies."""
        service = MentionService(mock_db)
        service.mention_repo = AsyncMock(spec=MentionRepository)
        service.user_repo = AsyncMock()
        service.post_repo = AsyncMock()
        return service
    
    @pytest.mark.asyncio
    async def test_extract_mentions_basic(self, mention_service):
        """Test basic mention extraction from text."""
        content = "Hello @john and @jane, how are you?"
        
        mentions = await mention_service.extract_mentions(content)
        
        assert len(mentions) == 2
        assert "john" in mentions
        assert "jane" in mentions
    
    @pytest.mark.asyncio
    async def test_extract_mentions_duplicates(self, mention_service):
        """Test mention extraction removes duplicates."""
        content = "Hello @john and @john again!"
        
        mentions = await mention_service.extract_mentions(content)
        
        assert len(mentions) == 1
        assert mentions[0] == "john"
    
    @pytest.mark.asyncio
    async def test_extract_mentions_empty_content(self, mention_service):
        """Test mention extraction with empty content."""
        mentions = await mention_service.extract_mentions("")
        assert mentions == []
        
        mentions = await mention_service.extract_mentions(None)
        assert mentions == []
    
    @pytest.mark.asyncio
    async def test_extract_mentions_no_mentions(self, mention_service):
        """Test mention extraction with no mentions."""
        content = "Hello world, no mentions here!"
        
        mentions = await mention_service.extract_mentions(content)
        
        assert mentions == []
    
    @pytest.mark.asyncio
    async def test_extract_mentions_complex_usernames(self, mention_service):
        """Test mention extraction with complex usernames."""
        content = "Hello @user123 and @test_user and @CamelCase"
        
        mentions = await mention_service.extract_mentions(content)
        
        assert len(mentions) == 3
        assert "user123" in mentions
        assert "test_user" in mentions
        assert "CamelCase" in mentions
    
    @pytest.mark.asyncio
    async def test_validate_mentions_all_valid(self, mention_service):
        """Test mention validation with all valid users."""
        usernames = ["john", "jane"]
        
        # Mock user repository responses
        john_user = User(id=1, username="john", email="john@test.com", hashed_password="hash")
        jane_user = User(id=2, username="jane", email="jane@test.com", hashed_password="hash")
        
        mention_service.user_repo.get_by_username.side_effect = [john_user, jane_user]
        
        valid_users = await mention_service.validate_mentions(usernames)
        
        assert len(valid_users) == 2
        assert valid_users[0].username == "john"
        assert valid_users[1].username == "jane"
    
    @pytest.mark.asyncio
    async def test_validate_mentions_some_invalid(self, mention_service):
        """Test mention validation with some invalid users."""
        usernames = ["john", "nonexistent"]
        
        # Mock user repository responses
        john_user = User(id=1, username="john", email="john@test.com", hashed_password="hash")
        
        mention_service.user_repo.get_by_username.side_effect = [john_user, None]
        
        valid_users = await mention_service.validate_mentions(usernames)
        
        assert len(valid_users) == 1
        assert valid_users[0].username == "john"
    
    @pytest.mark.asyncio
    async def test_validate_mentions_empty_list(self, mention_service):
        """Test mention validation with empty list."""
        valid_users = await mention_service.validate_mentions([])
        assert valid_users == []
    
    @pytest.mark.asyncio
    async def test_search_users_basic(self, mention_service):
        """Test basic user search functionality."""
        query = "joh"
        
        # Mock user repository response
        john_user = User(id=1, username="john", email="john@test.com", hashed_password="hash")
        mention_service.user_repo.search_by_username.return_value = [john_user]
        
        results = await mention_service.search_users(query)
        
        assert len(results) == 1
        assert results[0]["username"] == "john"
        assert results[0]["id"] == 1
        
        # Verify the repository was called correctly
        mention_service.user_repo.search_by_username.assert_called_once_with(
            query="joh",
            limit=10,
            exclude_user_ids=None
        )
    
    @pytest.mark.asyncio
    async def test_search_users_with_at_symbol(self, mention_service):
        """Test user search removes @ symbol from query."""
        query = "@joh"
        
        john_user = User(id=1, username="john", email="john@test.com", hashed_password="hash")
        mention_service.user_repo.search_by_username.return_value = [john_user]
        
        results = await mention_service.search_users(query)
        
        assert len(results) == 1
        
        # Verify @ was stripped from query
        mention_service.user_repo.search_by_username.assert_called_once_with(
            query="joh",
            limit=10,
            exclude_user_ids=None
        )
    
    @pytest.mark.asyncio
    async def test_search_users_empty_query(self, mention_service):
        """Test user search with empty query."""
        results = await mention_service.search_users("")
        assert results == []
        
        results = await mention_service.search_users("@")
        assert results == []
        
        results = await mention_service.search_users("   ")
        assert results == []
    
    @pytest.mark.asyncio
    async def test_search_users_with_exclusion(self, mention_service):
        """Test user search with user exclusion."""
        query = "joh"
        exclude_user_id = 5
        
        john_user = User(id=1, username="john", email="john@test.com", hashed_password="hash")
        mention_service.user_repo.search_by_username.return_value = [john_user]
        
        results = await mention_service.search_users(query, exclude_user_id=exclude_user_id)
        
        assert len(results) == 1
        
        # Verify exclusion was passed correctly
        mention_service.user_repo.search_by_username.assert_called_once_with(
            query="joh",
            limit=10,
            exclude_user_ids=[5]
        )
    
    @pytest.mark.asyncio
    async def test_validate_mention_permissions_valid(self, mention_service):
        """Test mention permission validation for valid case."""
        author_id = 1
        mentioned_user_id = 2
        
        # Mock user repository responses
        author = User(id=1, username="author", email="author@test.com", hashed_password="hash")
        mentioned_user = User(id=2, username="mentioned", email="mentioned@test.com", hashed_password="hash")
        
        mention_service.user_repo.get_by_id.side_effect = [author, mentioned_user]
        
        is_valid = await mention_service.validate_mention_permissions(author_id, mentioned_user_id)
        
        assert is_valid is True
    
    @pytest.mark.asyncio
    async def test_validate_mention_permissions_self_mention(self, mention_service):
        """Test mention permission validation prevents self-mentions."""
        author_id = 1
        mentioned_user_id = 1
        
        is_valid = await mention_service.validate_mention_permissions(author_id, mentioned_user_id)
        
        assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_validate_mention_permissions_nonexistent_users(self, mention_service):
        """Test mention permission validation with nonexistent users."""
        author_id = 1
        mentioned_user_id = 2
        
        # Mock user repository responses - author doesn't exist
        mention_service.user_repo.get_by_id.side_effect = [None, None]
        
        is_valid = await mention_service.validate_mention_permissions(author_id, mentioned_user_id)
        
        assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_highlight_mentions_basic(self, mention_service):
        """Test mention highlighting in content."""
        content = "Hello @john and @jane here"
        
        highlighted = await mention_service.highlight_mentions(content)
        
        expected = 'Hello <span class="mention">@john</span> and <span class="mention">@jane</span> here'
        assert highlighted == expected
    
    @pytest.mark.asyncio
    async def test_highlight_mentions_empty_content(self, mention_service):
        """Test mention highlighting with empty content."""
        highlighted = await mention_service.highlight_mentions("")
        assert highlighted == ""
        
        highlighted = await mention_service.highlight_mentions(None)
        assert highlighted is None
    
    @pytest.mark.asyncio
    async def test_highlight_mentions_no_mentions(self, mention_service):
        """Test mention highlighting with no mentions."""
        content = "Hello world!"
        
        highlighted = await mention_service.highlight_mentions(content)
        
        assert highlighted == content


class TestMentionRepository:
    """Test MentionRepository functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mention_repo(self, mock_db):
        """Create MentionRepository instance."""
        return MentionRepository(mock_db)
    
    @pytest.mark.asyncio
    async def test_check_mention_exists_true(self, mention_repo):
        """Test checking if mention exists returns True."""
        post_id = "test-post"
        mentioned_user_id = 1
        
        # Mock find_one to return a mention
        mock_mention = Mention(post_id=post_id, author_id=2, mentioned_user_id=mentioned_user_id)
        mention_repo.find_one = AsyncMock(return_value=mock_mention)
        
        exists = await mention_repo.check_mention_exists(post_id, mentioned_user_id)
        
        assert exists is True
        mention_repo.find_one.assert_called_once_with({
            "post_id": post_id,
            "mentioned_user_id": mentioned_user_id
        })
    
    @pytest.mark.asyncio
    async def test_check_mention_exists_false(self, mention_repo):
        """Test checking if mention exists returns False."""
        post_id = "test-post"
        mentioned_user_id = 1
        
        # Mock find_one to return None
        mention_repo.find_one = AsyncMock(return_value=None)
        
        exists = await mention_repo.check_mention_exists(post_id, mentioned_user_id)
        
        assert exists is False
    
    @pytest.mark.asyncio
    async def test_bulk_create_mentions_success(self, mention_repo):
        """Test bulk creation of mentions."""
        post_id = "test-post"
        author_id = 1
        mentioned_user_ids = [2, 3, 4]
        
        # Mock check_mention_exists to return False (no existing mentions)
        mention_repo.check_mention_exists = AsyncMock(return_value=False)
        
        # Mock create method
        created_mentions = []
        for user_id in mentioned_user_ids:
            mention = Mention(post_id=post_id, author_id=author_id, mentioned_user_id=user_id)
            created_mentions.append(mention)
        
        mention_repo.create = AsyncMock(side_effect=created_mentions)
        
        result = await mention_repo.bulk_create_mentions(post_id, author_id, mentioned_user_ids)
        
        assert len(result) == 3
        assert mention_repo.create.call_count == 3
    
    @pytest.mark.asyncio
    async def test_bulk_create_mentions_with_duplicates(self, mention_repo):
        """Test bulk creation skips existing mentions."""
        post_id = "test-post"
        author_id = 1
        mentioned_user_ids = [2, 3, 4]
        
        # Mock check_mention_exists - user 2 already has mention
        def mock_check_exists(pid, uid):
            return uid == 2  # User 2 already mentioned
        
        mention_repo.check_mention_exists = AsyncMock(side_effect=mock_check_exists)
        
        # Mock create method for new mentions only
        created_mentions = []
        for user_id in [3, 4]:  # Only users 3 and 4 should be created
            mention = Mention(post_id=post_id, author_id=author_id, mentioned_user_id=user_id)
            created_mentions.append(mention)
        
        mention_repo.create = AsyncMock(side_effect=created_mentions)
        
        result = await mention_repo.bulk_create_mentions(post_id, author_id, mentioned_user_ids)
        
        assert len(result) == 2  # Only 2 new mentions created
        assert mention_repo.create.call_count == 2