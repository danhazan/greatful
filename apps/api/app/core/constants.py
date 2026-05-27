"""
Centralized content limit constants.

These are the authoritative values for all content length validation.
Both API validators (Pydantic schemas) and service-layer checks
should import from here to prevent drift.
"""

# Comments & replies
COMMENT_MAX_LENGTH = 2000
COMMENT_MIN_LENGTH = 1

# Posts
POST_MAX_LENGTH = 10000
