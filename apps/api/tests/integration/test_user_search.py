
import pytest
import pytest_asyncio
from app.models.user import User
import uuid

@pytest.mark.asyncio
class TestUserSearchIntegration:
    """Integration tests for user search functionality."""

    async def test_search_by_username_partial(self, client, test_user, auth_headers, db_session):
        """Test searching by partial username."""
        # Create a user to find
        from app.core.security import get_password_hash
        user = User(
            email="findme@example.com",
            username="findme_user",
            hashed_password=get_password_hash("password"),
            display_name="Hidden Name"
        )
        db_session.add(user)
        await db_session.commit()

        response = client.post(
            "/api/v1/users/search",
            json={"query": "findme", "limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) >= 1
        found = any(u["username"] == "findme_user" for u in data)
        assert found

    async def test_search_by_display_name_partial(self, client, test_user, auth_headers, db_session):
        """Test searching by partial display name."""
        # Create a user to find by display name
        from app.core.security import get_password_hash
        user = User(
            email="display@example.com",
            username="random_username",
            hashed_password=get_password_hash("password"),
            display_name="Unique Display Name"
        )
        db_session.add(user)
        await db_session.commit()

        response = client.post(
            "/api/v1/users/search",
            json={"query": "Unique", "limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        
        # This assertion is expected to fail before the fix
        found = any(u["username"] == "random_username" for u in data)
        assert found, "Should find user by display name"

    async def test_search_response_includes_display_name(self, client, test_user, auth_headers, db_session):
        """Test that search results include display_name."""
        # Create a user with display name
        from app.core.security import get_password_hash
        user = User(
            email="result@example.com",
            username="result_user",
            hashed_password=get_password_hash("password"),
            display_name="Result Name"
        )
        db_session.add(user)
        await db_session.commit()

        response = client.post(
            "/api/v1/users/search",
            json={"query": "result", "limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        target_user = next((u for u in data if u["username"] == "result_user"), None)
        
        assert target_user is not None
        # This assertion is expected to fail before the fix
        assert "display_name" in target_user
        assert target_user["display_name"] == "Result Name"
