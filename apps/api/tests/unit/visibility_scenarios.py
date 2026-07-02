"""
Shared visibility scenario definitions for behavioural equivalence testing.

Each scenario describes a post's privacy configuration and a viewer's
relationship to the author, along with the expected visibility outcome.

Three test suites consume these scenarios:
  - tests/unit/test_visibility_pg_builder.py
  - tests/unit/test_visibility_sqlite_builder.py
  - tests/unit/test_visibility_orm.py

Each suite seeds the database from the same scenario data and asserts
that its implementation produces the expected decision.
"""

from dataclasses import dataclass, field
from typing import List


@dataclass
class VisibilityScenario:
    label: str
    privacy_level: str
    rule_types: List[str] = field(default_factory=list)
    specific_user_ids: List[int] = field(default_factory=list)
    viewer_is_author: bool = False
    viewer_follows_author: bool = False
    viewer_followed_by_author: bool = False
    viewer_is_specific_user: bool = False
    deleted: bool = False
    expected_visible: bool = False


VISIBILITY_SCENARIOS: List[VisibilityScenario] = [
    # --- Public ---
    VisibilityScenario(
        label="public, author sees",
        privacy_level="public",
        viewer_is_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="public, anyone sees",
        privacy_level="public",
        expected_visible=True,
    ),
    VisibilityScenario(
        label="public, deleted, blocked",
        privacy_level="public",
        expected_visible=False,
        deleted=True,
    ),
    # --- Private ---
    VisibilityScenario(
        label="private, author sees",
        privacy_level="private",
        viewer_is_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="private, follower blocked",
        privacy_level="private",
        viewer_follows_author=True,
        expected_visible=False,
    ),
    VisibilityScenario(
        label="private, followed-by blocked",
        privacy_level="private",
        viewer_followed_by_author=True,
        expected_visible=False,
    ),
    VisibilityScenario(
        label="private, specific-user blocked",
        privacy_level="private",
        viewer_is_specific_user=True,
        expected_visible=False,
    ),
    VisibilityScenario(
        label="private, stranger blocked",
        privacy_level="private",
        expected_visible=False,
    ),
    # --- Custom: followers rule ---
    VisibilityScenario(
        label="custom+follower, author sees",
        privacy_level="custom",
        rule_types=["followers"],
        viewer_is_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+follower, follower sees",
        privacy_level="custom",
        rule_types=["followers"],
        viewer_follows_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+follower, non-follower blocked",
        privacy_level="custom",
        rule_types=["followers"],
        expected_visible=False,
    ),
    VisibilityScenario(
        label="custom+follower, specific-user in ppu sees even without specific_users rule",
        privacy_level="custom",
        rule_types=["followers"],
        viewer_is_specific_user=True,
        expected_visible=True,
    ),
    # --- Custom: following rule ---
    VisibilityScenario(
        label="custom+following, author sees",
        privacy_level="custom",
        rule_types=["following"],
        viewer_is_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+following, followed-by sees",
        privacy_level="custom",
        rule_types=["following"],
        viewer_followed_by_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+following, not followed-by blocked",
        privacy_level="custom",
        rule_types=["following"],
        expected_visible=False,
    ),
    # --- Custom: specific_users rule ---
    VisibilityScenario(
        label="custom+specific, author sees",
        privacy_level="custom",
        rule_types=["specific_users"],
        specific_user_ids=[100],
        viewer_is_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+specific, specific user sees",
        privacy_level="custom",
        rule_types=["specific_users"],
        specific_user_ids=[100],
        viewer_is_specific_user=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+specific, non-specific blocked",
        privacy_level="custom",
        rule_types=["specific_users"],
        specific_user_ids=[100],
        viewer_is_specific_user=False,
        expected_visible=False,
    ),
    # --- Custom: combined followers + specific_users ---
    VisibilityScenario(
        label="custom+follower+specific, follower sees",
        privacy_level="custom",
        rule_types=["followers", "specific_users"],
        specific_user_ids=[200],
        viewer_follows_author=True,
        viewer_is_specific_user=False,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+follower+specific, specific-user sees",
        privacy_level="custom",
        rule_types=["followers", "specific_users"],
        specific_user_ids=[200],
        viewer_follows_author=False,
        viewer_is_specific_user=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+follower+specific, neither blocked",
        privacy_level="custom",
        rule_types=["followers", "specific_users"],
        specific_user_ids=[200],
        viewer_follows_author=False,
        viewer_is_specific_user=False,
        expected_visible=False,
    ),
    # --- Custom: combined followers + following ---
    VisibilityScenario(
        label="custom+follower+following, follower sees",
        privacy_level="custom",
        rule_types=["followers", "following"],
        viewer_follows_author=True,
        viewer_followed_by_author=False,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+follower+following, followed-by sees",
        privacy_level="custom",
        rule_types=["followers", "following"],
        viewer_follows_author=False,
        viewer_followed_by_author=True,
        expected_visible=True,
    ),
    VisibilityScenario(
        label="custom+follower+following, neither blocked",
        privacy_level="custom",
        rule_types=["followers", "following"],
        expected_visible=False,
    ),
    # --- Edge cases ---
    VisibilityScenario(
        label="deleted custom blocked even for author",
        privacy_level="custom",
        rule_types=["followers"],
        viewer_is_author=True,
        deleted=True,
        expected_visible=False,
    ),
]
