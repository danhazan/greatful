"""
Shared validation utilities.

Username validation is defined once here so every layer (Pydantic models, routes,
services) enforces the same rules. The DB CHECK constraint is the last line of
defense; this function is the application's validation boundary.
"""

import re

USERNAME_REGEX = re.compile(r'^[a-z0-9_]+$')


def validate_username_format(username: str) -> str:
    """Lowercase and validate username format. Returns lowercased username."""
    username_lower = username.lower()
    if not (3 <= len(username_lower) <= 30):
        raise ValueError('Username must be between 3 and 30 characters.')
    if not USERNAME_REGEX.match(username_lower):
        raise ValueError('Username can only contain letters, numbers, and underscores.')
    return username_lower
