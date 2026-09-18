#!/usr/bin/env python3
"""
J7 Slice 6a deployment gate: client_key idempotency contract probe.

Runs against a DEPLOYED backend (local dev server or Render) AFTER the 6a
migration + endpoints are deployed. Creates PRIVATE test posts and deletes
them afterwards; never touches other users' data.

Run:
  API_TOKEN=<bearer token for a test account> python scripts/probe_client_key_contract.py
Optional env:
  API_BASE_URL=https://grateful-api.onrender.com

Checks (STOP on first failure):
  1. migration present: JSON create with client_key echoes it (pre-6a: absent)
  2. JSON create -> 201 + echo; replay same key -> 200 + same id
  3. me/posts shows exactly one post for the key (no duplicate)
  4. multipart create with key+image -> 201; replay WITHOUT files -> 200 same id
  5. deleted-key reuse: create -> delete -> create => NEW id
  6. cleanup: all probe posts deleted

Cross-author isolation is covered by local tests (needs two accounts);
it is not probed here.
"""

from __future__ import annotations

import io
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

API_BASE = os.environ.get("API_BASE_URL", "https://grateful-api.onrender.com").rstrip("/")
TOKEN = os.environ.get("API_TOKEN", "")

# Minimal valid 1x1 PNG (opaque black). force_upload=true bypasses hash dedupe.
PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de"
    "0000000c4944415478da6360606000000004000145c9028b0000000049454e44ae426082"
)

FAILURES: list[str] = []
CREATED_IDS: list[str] = []


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    FAILURES.append(message)


def ok(message: str) -> None:
    print(f"ok: {message}")


def api(method: str, path: str, body: dict | None = None) -> tuple[int, dict | list]:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode() or "null"
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"raw": raw}


def api_multipart(path: str, fields: dict[str, str], files: dict[str, tuple[str, bytes, str]] | None = None):
    boundary = f"----probe{uuid.uuid4().hex}"
    buf = io.BytesIO()
    for name, value in fields.items():
        buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
    for name, (filename, content, mime) in (files or {}).items():
        buf.write(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n".encode()
        )
        buf.write(content)
        buf.write(b"\r\n")
    buf.write(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        method="POST",
        data=buf.getvalue(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode() or "null"
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"raw": raw}


def unwrap(payload):
    if isinstance(payload, dict) and "data" in payload and isinstance(payload["data"], (dict, list)):
        return payload["data"]
    return payload


def main() -> int:
    if not TOKEN:
        fail("API_TOKEN env is required (bearer token for a test account)")
        return 1

    # --- JSON create + replay ---
    key_json = f"probe-{uuid.uuid4()}"
    status, first = api("POST", "/api/v1/posts", {
        "content": "6a probe post (private, will be deleted)",
        "privacy_level": "private",
        "client_key": key_json,
    })
    first = unwrap(first)
    if status != 201:
        fail(f"JSON create expected 201, got {status}: {first}")
        return 1
    if not isinstance(first, dict) or first.get("clientKey") != key_json or not first.get("id"):
        fail(f"JSON create must echo clientKey with non-empty id, got: {first}")
        return 1
    ok(f"JSON create 201 + echo (id={first['id']})")
    CREATED_IDS.append(first["id"])

    status, second = api("POST", "/api/v1/posts", {
        "content": "6a probe post (private, will be deleted)",
        "privacy_level": "private",
        "client_key": key_json,
    })
    second = unwrap(second)
    if status != 200:
        fail(f"JSON replay expected 200, got {status}: {second}")
    elif not isinstance(second, dict) or second.get("id") != first["id"]:
        fail(f"JSON replay must return same id {first['id']}, got: {second}")
    else:
        ok("JSON replay 200 + same id")

    status, mine = api("GET", "/api/v1/users/me/posts")
    mine = unwrap(mine)
    if status != 200 or not isinstance(mine, list):
        fail(f"me/posts expected 200 list, got {status}")
    else:
        # NOTE: the list serializer does not carry clientKey (out of 6a
        # scope); uniqueness is proven by counting the known replayed id.
        seen = sum(1 for p in mine if isinstance(p, dict) and p.get("id") == first["id"])
        if seen != 1:
            fail(f"me/posts must contain the replayed id exactly once, saw {seen} (duplicate created?)")
        else:
            ok("me/posts shows the replayed post exactly once")

    # --- multipart create + replay (no re-upload) ---
    key_up = f"probe-{uuid.uuid4()}"
    status, up_first = api_multipart(
        "/api/v1/posts/upload",
        {"content": "6a probe upload (private, will be deleted)",
         "privacy_level": "private", "client_key": key_up, "force_upload": "true"},
        {"images": ("probe.png", PNG_1X1, "image/png")},
    )
    up_first = unwrap(up_first)
    if status != 201:
        fail(f"multipart create expected 201, got {status}: {up_first}")
        return 1
    if not isinstance(up_first, dict) or up_first.get("clientKey") != key_up or not up_first.get("id"):
        fail(f"multipart create must echo clientKey with non-empty id, got: {up_first}")
        return 1
    ok(f"multipart create 201 + echo (id={up_first['id']}, images={len(up_first.get('images', []))})")
    CREATED_IDS.append(up_first["id"])

    status, up_second = api_multipart(
        "/api/v1/posts/upload",
        {"content": "6a probe upload (private, will be deleted)",
         "privacy_level": "private", "client_key": key_up},
        None,
    )
    up_second = unwrap(up_second)
    if status != 200:
        fail(f"multipart replay expected 200, got {status}: {up_second}")
    elif not isinstance(up_second, dict) or up_second.get("id") != up_first["id"]:
        fail(f"multipart replay must return same id {up_first['id']}, got: {up_second}")
    else:
        ok("multipart replay 200 + same id (no re-upload)")

    # --- deleted-key reuse ---
    key_del = f"probe-{uuid.uuid4()}"
    status, doomed = api("POST", "/api/v1/posts", {
        "content": "6a probe doomed post", "privacy_level": "private", "client_key": key_del,
    })
    doomed = unwrap(doomed)
    if status != 201 or not isinstance(doomed, dict) or not doomed.get("id"):
        fail(f"deleted-reuse setup create failed: {status}: {doomed}")
        return 1
    status, _ = api("DELETE", f"/api/v1/posts/{doomed['id']}")
    if status != 200:
        fail(f"deleted-reuse setup delete expected 200, got {status}")
        return 1
    status, reborn = api("POST", "/api/v1/posts", {
        "content": "6a probe reborn post", "privacy_level": "private", "client_key": key_del,
    })
    reborn = unwrap(reborn)
    if status != 201:
        fail(f"deleted-key reuse expected 201, got {status}: {reborn}")
    elif not isinstance(reborn, dict) or reborn.get("id") == doomed["id"]:
        fail(f"deleted-key reuse must create a NEW id, got: {reborn}")
    else:
        ok(f"deleted-key reuse created new post (old={doomed['id']} new={reborn['id']})")
        CREATED_IDS.append(reborn["id"])

    # --- cleanup ---
    for post_id in CREATED_IDS:
        status, _ = api("DELETE", f"/api/v1/posts/{post_id}")
        if status != 200:
            fail(f"cleanup DELETE {post_id} expected 200, got {status}")
    if not FAILURES:
        ok(f"cleanup deleted {len(CREATED_IDS)} probe posts")

    print("PROBE PASS" if not FAILURES else f"PROBE FAIL ({len(FAILURES)} failures)")
    return 0 if not FAILURES else 1


if __name__ == "__main__":
    sys.exit(main())
