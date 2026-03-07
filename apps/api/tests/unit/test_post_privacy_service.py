import pytest

from app.services.post_privacy_service import PostPrivacyService


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

