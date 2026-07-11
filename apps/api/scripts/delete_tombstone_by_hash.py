#!/usr/bin/env python3
"""
Delete records from deleted_user_auth_identities by email_hash.

Usage:
  cd apps/api
  python scripts/delete_tombstone_by_hash.py <hash>

Dry run with --dry-run flag to preview without deleting.
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete
from app.core.database import async_session
from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity


async def delete_by_hash(hash_value: str, dry_run: bool):
    async with async_session() as session:
        result = await session.execute(
            select(DeletedUserAuthIdentity).where(
                DeletedUserAuthIdentity.email_hash == hash_value
            )
        )
        records = result.scalars().all()

        if not records:
            print(f"No records found with email_hash: {hash_value}")
            return

        print(f"Found {len(records)} record(s):")
        for r in records:
            print(f"  id={r.id} user_id={r.user_id} type={r.identity_type} provider={r.provider}")

        if dry_run:
            print("Dry run — no records deleted.")
            return

        confirm = input(f"Delete {len(records)} record(s)? (yes/no): ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

        await session.execute(
            delete(DeletedUserAuthIdentity).where(
                DeletedUserAuthIdentity.email_hash == hash_value
            )
        )
        await session.commit()
        print(f"Deleted {len(records)} record(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete tombstone records by email_hash.")
    parser.add_argument("hash", help="email_hash value to match")
    parser.add_argument("--dry-run", action="store_true", help="Preview without deleting")
    args = parser.parse_args()

    try:
        asyncio.run(delete_by_hash(args.hash, args.dry_run))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
