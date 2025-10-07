
import asyncio
import os
import re
import sys
import argparse
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

async def generate_unique_username(session: AsyncSession, original_username: str) -> str:
    """
    Generates a unique, valid username.
    """
    # 1. Sanitize the username
    new_username = original_username.lower()
    new_username = re.sub(r'[^a-z0-9_]', '_', new_username)
    new_username = new_username[:30]

    # Ensure username is not too short
    if len(new_username) < 3:
        new_username = f"{new_username}{'_' * (3 - len(new_username))}"

    # 2. Check for uniqueness
    base_username = new_username
    counter = 1
    while True:
        result = await session.execute(select(User).where(User.username == new_username))
        if result.scalar_one_or_none() is None:
            return new_username
        new_username = f"{base_username[:28]}_{counter}" # Truncate to fit counter
        counter += 1

async def cleanup_invalid_usernames(dry_run: bool):
    """
    Connects to the database, finds invalid usernames, and fixes them.
    """
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()

        print(f"Found {len(users)} total users. Checking and cleaning usernames...")
        print(f"Dry run: {dry_run}")
        print("-" * 30)

        for user in users:
            errors = validate_username(user.username)
            if errors:
                print(f"User ID: {user.id}, Invalid Username: '{user.username}'")
                for error in errors:
                    print(f"  - {error}")
                
                new_username = await generate_unique_username(session, user.username)
                print(f"  => Proposed new username: '{new_username}'")

                if not dry_run:
                    user.username = new_username
                    print(f"  => Updated username for user {user.id}")
                
                print("")

        if not dry_run:
            await session.commit()
            print("Database has been updated.")
        else:
            print("Dry run complete. No changes were made to the database.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Clean up invalid usernames in the database.')
    parser.add_argument('--dry-run', action='store_true', help='If set, the script will only print the proposed changes without modifying the database.')
    args = parser.parse_args()

    asyncio.run(cleanup_invalid_usernames(args.dry_run))
