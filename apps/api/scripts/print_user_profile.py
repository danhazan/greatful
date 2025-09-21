#!/usr/bin/env python3
"""
Usage:
  cd apps/api
  python scripts/print_user_profile.py --email user@example.com

Description:
  Prints the user profile for the given email from the database using the app's async SQLAlchemy setup.
  Must be run from the backend (apps/api) directory with virtualenv activated.
"""
import argparse
import asyncio
import sys
import os
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_async_sessionmaker
from app.models.user import User

async def print_user_by_email(email):
    AsyncSessionLocal = get_async_sessionmaker()
    async with AsyncSessionLocal() as session:
        result = await session.execute(User.__table__.select().where(User.email == email))
        user = result.first()
        if user:
            print("User found:")
            for k, v in dict(user._mapping).items():
                print(f"  {k}: {v}")
        else:
            print(f"No user found with email: {email}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Print user profile by email.")
    parser.add_argument("--email", required=True, help="User email to search for.")
    args = parser.parse_args()
    try:
        asyncio.run(print_user_by_email(args.email))
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1) 