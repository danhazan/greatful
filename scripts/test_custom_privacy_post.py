#!/usr/bin/env python3
"""
Diagnostic script for custom post privacy persistence against the real API + PostgreSQL DB.

This intentionally runs outside the SQLite test harness to validate end-to-end behavior
in the real runtime path:
1) call POST /api/v1/posts with custom privacy payload
2) verify persisted rows in posts/post_privacy_rules/post_privacy_users

Run:
  python scripts/test_custom_privacy_post.py

Required env:
  API_TOKEN=<bearer token>
Optional env:
  API_BASE_URL=http://localhost:8000
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from urllib import error, request

from sqlalchemy import select

# Make backend package importable when running from repo root.
REPO_ROOT = Path(__file__).resolve().parents[1]
API_APP_ROOT = REPO_ROOT / "apps" / "api"
sys.path.insert(0, str(API_APP_ROOT))

from app.core.database import async_session  # type: ignore  # noqa: E402
from app.models.post import Post  # type: ignore  # noqa: E402
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser  # type: ignore  # noqa: E402


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    raise SystemExit(1)


def create_custom_post(api_base_url: str, token: str, user_id:str) -> str:
    payload = {
        "content": "Custom privacy diagnostic test",
        "privacy_level": "custom",
        "rules": ["specific_users"],
        "specific_users": [int(user_id)],
    }

    url = f"{api_base_url.rstrip('/')}/api/v1/posts"
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=30) as resp:
            status_code = resp.status
            body_text = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        print("[POST TEST]")
        print(f"status_code={exc.code}")
        print(f"response_json={body_text}")
        fail("POST /api/v1/posts did not return 201")
    except Exception as exc:  # pragma: no cover - defensive script error handling
        fail(f"Request failed: {exc}")

    try:
        response_json = json.loads(body_text) if body_text else {}
    except json.JSONDecodeError:
        response_json = {"raw": body_text}

    print("[POST TEST]")
    print(f"status_code={status_code}")
    print(f"response_json={json.dumps(response_json, ensure_ascii=True)}")

    if status_code != 201:
        fail(f"Expected 201 but got {status_code}")

    created_post_id = (
        response_json.get("id")
        or response_json.get("data", {}).get("id")
        or response_json.get("post", {}).get("id")
    )
    if not created_post_id:
        fail("Could not find created post id in response")

    print()
    print(f"created_post_id={created_post_id}")
    return str(created_post_id)


async def verify_db_rows(post_id: str) -> None:
    async with async_session() as session:
        post_result = await session.execute(
            select(Post.id, Post.privacy_level, Post.author_id).where(Post.id == post_id)
        )
        post_row = post_result.first()

        if not post_row:
            fail(f"Post {post_id} not found in DB")

        rules_result = await session.execute(
            select(PostPrivacyRule.post_id, PostPrivacyRule.rule_type)
            .where(PostPrivacyRule.post_id == post_id)
            .order_by(PostPrivacyRule.rule_type.asc())
        )
        rules_rows = [dict(row._mapping) for row in rules_result.fetchall()]

        users_result = await session.execute(
            select(PostPrivacyUser.post_id, PostPrivacyUser.user_id)
            .where(PostPrivacyUser.post_id == post_id)
            .order_by(PostPrivacyUser.user_id.asc())
        )
        users_rows = [dict(row._mapping) for row in users_result.fetchall()]

    print()
    print("[DB CHECK]")
    print(f"post_id={post_id}")
    print(f"privacy_level={post_row.privacy_level}")
    print(f"rules_rows={rules_rows}")
    print(f"users_rows={users_rows}")

    if post_row.privacy_level != "custom":
        fail(f"Expected posts.privacy_level='custom', got '{post_row.privacy_level}'")
    if not rules_rows:
        fail("No rows written to post_privacy_rules")
    if not users_rows:
        fail("No rows written to post_privacy_users")


def main() -> None:
    token = os.getenv("API_TOKEN", "").strip()
    if not token:
        fail("API_TOKEN env var is required")
    
    
    user_id = os.getenv("USER_ID", "").strip()
    if not user_id:
        fail("USER_ID env var is required")

    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000").strip()

    post_id = create_custom_post(api_base_url=api_base_url, token=token, user_id=user_id)
    asyncio.run(verify_db_rows(post_id))


if __name__ == "__main__":
    main()
