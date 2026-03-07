import pytest

from app.services.post_privacy_service import PostPrivacyService


class _DummyDialect:
    def __init__(self, name: str):
        self.name = name


class _DummyBind:
    def __init__(self, dialect_name: str):
        self.dialect = _DummyDialect(dialect_name)


class _DummyDB:
    def __init__(self, dialect_name: str):
        self.bind = _DummyBind(dialect_name)


def test_resolve_config_defaults_to_public():
    config = PostPrivacyService.resolve_config(is_public=True)
    assert config.level == "public"
    assert config.rules == []
    assert config.specific_user_ids == []
    assert config.is_public is True


def test_resolve_config_maps_legacy_private():
    config = PostPrivacyService.resolve_config(is_public=False)
    assert config.level == "private"
    assert config.is_public is False


def test_resolve_config_custom_rules_and_specific_users():
    config = PostPrivacyService.resolve_config(
        privacy_level="custom",
        rules=["followers", "followers"],
        specific_users=[7, 7, 9],
        author_id=1,
    )
    assert config.level == "custom"
    assert "followers" in config.rules
    assert "specific_users" in config.rules
    assert config.specific_user_ids == [7, 9]


def test_resolve_config_rejects_custom_without_rules():
    with pytest.raises(ValueError):
        PostPrivacyService.resolve_config(privacy_level="custom", rules=[], specific_users=[])


def test_resolve_config_rejects_unknown_rule():
    with pytest.raises(ValueError):
        PostPrivacyService.resolve_config(privacy_level="custom", rules=["unknown_rule"])


def test_visibility_filter_clause_uses_db_function_on_postgresql():
    db = _DummyDB("postgresql")
    clause = PostPrivacyService.visibility_filter_clause(42, db)
    assert "can_view_post" in str(clause)


def test_visibility_filter_clause_uses_sqlalchemy_fallback_on_sqlite():
    db = _DummyDB("sqlite")
    clause = PostPrivacyService.visibility_filter_clause(42, db)
    assert "can_view_post" not in str(clause)
