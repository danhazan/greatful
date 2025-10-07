
import asyncio
import os
import re
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.user import User

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:iamgreatful@localhost:5432/grateful"
)

def validate_username(username: str) -> list[str]:
    """
    Validates a username against the new rules.
    Returns a list of validation error messages.
    """
    errors = []
    if not username:
        errors.append("Username is empty or None.")
        return errors

    username_lower = username.lower()
    if not (3 <= len(username_lower) <= 30):
        errors.append(f"Invalid length: {len(username_lower)} characters. Must be between 3 and 30.")
    if not re.match(r'^[a-z0-9_]+$', username_lower):
        errors.append("Contains invalid characters. Can only contain lowercase letters, numbers, and underscores.")
    if username != username_lower:
        errors.append("Contains uppercase letters.")
    return errors

async def find_invalid_usernames():
    """
    Connects to the database, fetches all users, and checks for invalid usernames.
    """
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()

        print(f"Found {len(users)} total users. Checking usernames...")
        print("-" * 30)

        invalid_users_count = 0
        for user in users:
            errors = validate_username(user.username)
            if errors:
                invalid_users_count += 1
                print(f"User ID: {user.id}, Username: '{user.username}'")
                for error in errors:
                    print(f"  - {error}")
                print("")

        if invalid_users_count == 0:
            print("All usernames are valid!")
        else:
            print(f"Found {invalid_users_count} users with invalid usernames.")

if __name__ == "__main__":
    asyncio.run(find_invalid_usernames())
