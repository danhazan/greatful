"""
Unit tests for follow repository functionality.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.follow_repository import FollowRepository
from app.models.follow import Follow
from app.models.user import User


class TestFollowRepository:
    """Test cases for FollowRepository."""

    @pytest.mark.asyncio
    async def test_create_follow_success(self, db_session: AsyncSession):
        """Test successful follow creation."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository
        follow_repo = FollowRepository(db_session)
        
        # Create follow relationship
        follow = await follow_repo.create(
            follower_id=user1.id,
            followed_id=user2.id,
            status="active"
        )
        
        assert follow.follower_id == user1.id
        assert follow.followed_id == user2.id
        assert follow.status == "active"
        assert follow.id is not None
        assert follow.created_at is not None

    @pytest.mark.asyncio
    async def test_get_follow_relationship_exists(self, db_session: AsyncSession):
        """Test getting existing follow relationship."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository and relationship
        follow_repo = FollowRepository(db_session)
        created_follow = await follow_repo.create(
            follower_id=user1.id,
            followed_id=user2.id,
            status="active"
        )
        
        # Get follow relationship
        follow = await follow_repo.get_follow_relationship(user1.id, user2.id)
        
        assert follow is not None
        assert follow.id == created_follow.id
        assert follow.follower_id == user1.id
        assert follow.followed_id == user2.id
        assert follow.status == "active"

    @pytest.mark.asyncio
    async def test_get_follow_relationship_not_exists(self, db_session: AsyncSession):
        """Test getting non-existent follow relationship."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository
        follow_repo = FollowRepository(db_session)
        
        # Try to get non-existent follow relationship
        follow = await follow_repo.get_follow_relationship(user1.id, user2.id)
        
        assert follow is None

    @pytest.mark.asyncio
    async def test_delete_follow_success(self, db_session: AsyncSession):
        """Test successful follow deletion."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository and relationship
        follow_repo = FollowRepository(db_session)
        follow = await follow_repo.create(
            follower_id=user1.id,
            followed_id=user2.id,
            status="active"
        )
        
        # Delete follow relationship
        result = await follow_repo.delete(follow)
        
        assert result is True
        
        # Verify it's deleted
        deleted_follow = await follow_repo.get_follow_relationship(user1.id, user2.id)
        assert deleted_follow is None

    @pytest.mark.asyncio
    async def test_get_followers_success(self, db_session: AsyncSession):
        """Test getting user followers."""
        # Create main user and followers
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        follower1 = User(username="follower1", email="follower1@example.com", hashed_password="hashed")
        follower2 = User(username="follower2", email="follower2@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, follower1, follower2])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(follower1)
        await db_session.refresh(follower2)
        
        # Create follow repository and relationships
        follow_repo = FollowRepository(db_session)
        await follow_repo.create(follower_id=follower1.id, followed_id=main_user.id, status="active")
        await follow_repo.create(follower_id=follower2.id, followed_id=main_user.id, status="active")
        
        # Get followers
        followers, total_count = await follow_repo.get_followers(main_user.id, limit=10, offset=0)
        
        assert total_count == 2
        assert len(followers) == 2
        
        follower_usernames = [f.username for f in followers]
        assert "follower1" in follower_usernames
        assert "follower2" in follower_usernames

    @pytest.mark.asyncio
    async def test_get_followers_pagination(self, db_session: AsyncSession):
        """Test followers pagination."""
        # Create main user and 5 followers
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        db_session.add(main_user)
        
        followers = []
        for i in range(5):
            follower = User(
                username=f"follower_{i}",
                email=f"follower_{i}@example.com",
                hashed_password="hashed"
            )
            followers.append(follower)
            db_session.add(follower)
        
        await db_session.commit()
        await db_session.refresh(main_user)
        for follower in followers:
            await db_session.refresh(follower)
        
        # Create follow repository and relationships
        follow_repo = FollowRepository(db_session)
        for follower in followers:
            await follow_repo.create(
                follower_id=follower.id,
                followed_id=main_user.id,
                status="active"
            )
        
        # Test first page
        page1_followers, total_count = await follow_repo.get_followers(
            main_user.id, limit=3, offset=0
        )
        
        assert total_count == 5
        assert len(page1_followers) == 3
        
        # Test second page
        page2_followers, total_count = await follow_repo.get_followers(
            main_user.id, limit=3, offset=3
        )
        
        assert total_count == 5
        assert len(page2_followers) == 2

    @pytest.mark.asyncio
    async def test_get_following_success(self, db_session: AsyncSession):
        """Test getting users that a user is following."""
        # Create main user and users to follow
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        followed1 = User(username="followed1", email="followed1@example.com", hashed_password="hashed")
        followed2 = User(username="followed2", email="followed2@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, followed1, followed2])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(followed1)
        await db_session.refresh(followed2)
        
        # Create follow repository and relationships
        follow_repo = FollowRepository(db_session)
        await follow_repo.create(follower_id=main_user.id, followed_id=followed1.id, status="active")
        await follow_repo.create(follower_id=main_user.id, followed_id=followed2.id, status="active")
        
        # Get following
        following, total_count = await follow_repo.get_following(main_user.id, limit=10, offset=0)
        
        assert total_count == 2
        assert len(following) == 2
        
        following_usernames = [f.username for f in following]
        assert "followed1" in following_usernames
        assert "followed2" in following_usernames

    @pytest.mark.asyncio
    async def test_is_following_true(self, db_session: AsyncSession):
        """Test is_following returns True when following."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository and relationship
        follow_repo = FollowRepository(db_session)
        await follow_repo.create(follower_id=user1.id, followed_id=user2.id, status="active")
        
        # Check if following
        is_following = await follow_repo.is_following(user1.id, user2.id)
        
        assert is_following is True

    @pytest.mark.asyncio
    async def test_is_following_false(self, db_session: AsyncSession):
        """Test is_following returns False when not following."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository (no relationship)
        follow_repo = FollowRepository(db_session)
        
        # Check if following
        is_following = await follow_repo.is_following(user1.id, user2.id)
        
        assert is_following is False

    @pytest.mark.asyncio
    async def test_get_follow_stats_success(self, db_session: AsyncSession):
        """Test getting follow statistics."""
        # Create main user and related users
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        follower1 = User(username="follower1", email="follower1@example.com", hashed_password="hashed")
        follower2 = User(username="follower2", email="follower2@example.com", hashed_password="hashed")
        followed1 = User(username="followed1", email="followed1@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, follower1, follower2, followed1])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(follower1)
        await db_session.refresh(follower2)
        await db_session.refresh(followed1)
        
        # Create follow repository and relationships
        follow_repo = FollowRepository(db_session)
        
        # Create followers (2 users follow main_user)
        await follow_repo.create(follower_id=follower1.id, followed_id=main_user.id, status="active")
        await follow_repo.create(follower_id=follower2.id, followed_id=main_user.id, status="active")
        
        # Create following (main_user follows 1 user)
        await follow_repo.create(follower_id=main_user.id, followed_id=followed1.id, status="active")
        
        # Get follow stats
        stats = await follow_repo.get_follow_stats(main_user.id)
        
        assert stats["followers_count"] == 2
        assert stats["following_count"] == 1
        assert "pending_requests" in stats
        assert "pending_sent" in stats

    @pytest.mark.asyncio
    async def test_get_follow_suggestions_success(self, db_session: AsyncSession):
        """Test getting follow suggestions."""
        # Create users
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        user3 = User(username="user3", email="user3@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, user1, user2, user3])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        await db_session.refresh(user3)
        
        # Create follow repository
        follow_repo = FollowRepository(db_session)
        
        # Create some follow relationships to influence suggestions
        await follow_repo.create(follower_id=main_user.id, followed_id=user1.id, status="active")
        
        # Get follow suggestions
        suggestions = await follow_repo.get_follow_suggestions(main_user.id, limit=5)
        
        assert isinstance(suggestions, list)
        # Should not include main_user or already followed users
        suggestion_ids = [s.id for s in suggestions]
        assert main_user.id not in suggestion_ids
        assert user1.id not in suggestion_ids  # Already following

    @pytest.mark.asyncio
    async def test_bulk_check_following_status_success(self, db_session: AsyncSession):
        """Test bulk checking following status."""
        # Create users
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        user3 = User(username="user3", email="user3@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, user1, user2, user3])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        await db_session.refresh(user3)
        
        # Create follow repository and some relationships
        follow_repo = FollowRepository(db_session)
        await follow_repo.create(follower_id=main_user.id, followed_id=user1.id, status="active")
        await follow_repo.create(follower_id=main_user.id, followed_id=user2.id, status="pending")
        # user3 - no relationship
        
        # Bulk check following status
        user_ids = [user1.id, user2.id, user3.id]
        status_map = await follow_repo.bulk_check_following_status(main_user.id, user_ids)
        
        assert status_map[user1.id] == "active"
        assert status_map[user2.id] == "pending"
        assert status_map[user3.id] is None

    @pytest.mark.asyncio
    async def test_follow_constraints(self, db_session: AsyncSession):
        """Test follow model constraints."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hashed")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hashed")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create follow repository and relationship
        follow_repo = FollowRepository(db_session)
        await follow_repo.create(follower_id=user1.id, followed_id=user2.id, status="active")
        
        # Try to create duplicate follow relationship (should fail)
        with pytest.raises(Exception):  # Should raise integrity error
            await follow_repo.create(follower_id=user1.id, followed_id=user2.id, status="active")

    @pytest.mark.asyncio
    async def test_follow_status_filtering(self, db_session: AsyncSession):
        """Test that only active follows are counted in stats."""
        # Create users
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        follower1 = User(username="follower1", email="follower1@example.com", hashed_password="hashed")
        follower2 = User(username="follower2", email="follower2@example.com", hashed_password="hashed")
        follower3 = User(username="follower3", email="follower3@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, follower1, follower2, follower3])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(follower1)
        await db_session.refresh(follower2)
        await db_session.refresh(follower3)
        
        # Create follow repository and relationships with different statuses
        follow_repo = FollowRepository(db_session)
        await follow_repo.create(follower_id=follower1.id, followed_id=main_user.id, status="active")
        await follow_repo.create(follower_id=follower2.id, followed_id=main_user.id, status="pending")
        await follow_repo.create(follower_id=follower3.id, followed_id=main_user.id, status="blocked")
        
        # Get followers (should only return active)
        followers, total_count = await follow_repo.get_followers(main_user.id, limit=10, offset=0)
        
        assert total_count == 1  # Only active follow
        assert len(followers) == 1
        assert followers[0].username == "follower1"
        
        # Get follow stats
        stats = await follow_repo.get_follow_stats(main_user.id)
        assert stats["followers_count"] == 1  # Only active follows counted

    @pytest.mark.asyncio
    async def test_follow_ordering(self, db_session: AsyncSession):
        """Test that follows are retrieved correctly."""
        # Create main user and followers
        main_user = User(username="main_user", email="main@example.com", hashed_password="hashed")
        follower1 = User(username="follower1", email="follower1@example.com", hashed_password="hashed")
        follower2 = User(username="follower2", email="follower2@example.com", hashed_password="hashed")
        
        db_session.add_all([main_user, follower1, follower2])
        await db_session.commit()
        await db_session.refresh(main_user)
        await db_session.refresh(follower1)
        await db_session.refresh(follower2)
        
        # Create follow repository and relationships
        follow_repo = FollowRepository(db_session)
        follow1 = await follow_repo.create(follower_id=follower1.id, followed_id=main_user.id, status="active")
        follow2 = await follow_repo.create(follower_id=follower2.id, followed_id=main_user.id, status="active")
        
        # Get followers
        followers, total_count = await follow_repo.get_followers(main_user.id, limit=10, offset=0)
        
        assert total_count == 2
        assert len(followers) == 2
        
        # Check that we have both followers
        follower_usernames = [f.username for f in followers]
        assert "follower1" in follower_usernames
        assert "follower2" in follower_usernames
        
        # Verify the follow objects exist
        assert follow1.id is not None
        assert follow2.id is not None