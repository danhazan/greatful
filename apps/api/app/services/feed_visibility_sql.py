"""
Feed-level post visibility SQL fragment builder.

Responsibility:
  Generate the post visibility WHERE clause for the feed query as a raw SQL string
  with all predicates visible to the planner.

  The generated SQL uses only standard EXISTS / IN / AND / OR so it works on
  both PostgreSQL and SQLite without dialect-specific syntax.

Related implementation (must produce identical visibility decisions):
  - ``PostPrivacyService.visible_to_user_clause()`` — ORM-level expression

See ``../docs/FEED_SYSTEM.md`` for architecture rationale and the
shared scenario matrix that validates behavioural equivalence across all
implementations.
"""


def build_visibility_sql(
    dialect: str = "postgresql",
    uid_placeholder: str = ":uid",
    table_alias: str = "p",
    include_deleted_check: bool = True,
) -> str:
    """Return a SQL fragment that evaluates whether *uid_placeholder* can
    view a post aliased as *table_alias*.

    Parameters
    ----------
    dialect :
        Target database dialect. Currently both ``"postgresql"`` and
        ``"sqlite"`` produce identical SQL because the logic uses only
        standard features.  Reserved for future dialect-specific needs.
    uid_placeholder :
        How the viewer identity appears in the generated SQL, for example
        ``":uid"`` (named bind parameter) or ``"42"`` (literal).
    table_alias :
        Table alias used for the ``posts`` row, typically ``"p"``.
    include_deleted_check :
        Whether to prepend ``{table_alias}.deleted_at IS NULL``.
    """
    rules_alias = "ppr"
    follower_follows_alias = "vf"
    following_follows_alias = "af"
    users_alias = "ppu"

    fragments = [
        f"    {table_alias}.author_id = {uid_placeholder}",
        f"    {table_alias}.privacy_level = 'public'",
        (
            f"    ({table_alias}.privacy_level = 'custom' AND ("
            f"\n"
            f"        (\n"
            f"            EXISTS (\n"
            f"                SELECT 1 FROM post_privacy_rules {rules_alias}\n"
            f"                WHERE {rules_alias}.post_id = {table_alias}.id\n"
            f"                  AND {rules_alias}.rule_type = 'followers'\n"
            f"            )\n"
            f"            AND EXISTS (\n"
            f"                SELECT 1 FROM follows {follower_follows_alias}\n"
            f"                WHERE {follower_follows_alias}.follower_id = {uid_placeholder}\n"
            f"                  AND {follower_follows_alias}.followed_id = {table_alias}.author_id\n"
            f"                  AND {follower_follows_alias}.status = 'active'\n"
            f"            )\n"
            f"        )\n"
            f"        OR\n"
            f"        (\n"
            f"            EXISTS (\n"
            f"                SELECT 1 FROM post_privacy_rules {rules_alias}\n"
            f"                WHERE {rules_alias}.post_id = {table_alias}.id\n"
            f"                  AND {rules_alias}.rule_type = 'following'\n"
            f"            )\n"
            f"            AND EXISTS (\n"
            f"                SELECT 1 FROM follows {following_follows_alias}\n"
            f"                WHERE {following_follows_alias}.follower_id = {table_alias}.author_id\n"
            f"                  AND {following_follows_alias}.followed_id = {uid_placeholder}\n"
            f"                  AND {following_follows_alias}.status = 'active'\n"
            f"            )\n"
            f"        )\n"
            f"        OR\n"
            f"        EXISTS (\n"
            f"            SELECT 1 FROM post_privacy_users {users_alias}\n"
            f"            WHERE {users_alias}.post_id = {table_alias}.id\n"
            f"              AND {users_alias}.user_id = {uid_placeholder}\n"
            f"        )\n"
            f"    ))"
        ),
    ]

    clause = "(\n" + "\nOR\n".join(fragments) + "\n)"

    if include_deleted_check:
        clause = f"{table_alias}.deleted_at IS NULL AND {clause}"

    return clause
