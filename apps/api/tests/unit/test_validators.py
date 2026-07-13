"""
Unit tests for shared validators.
"""

import pytest
from app.core.validators import validate_username_format


class TestValidateUsernameFormat:
    def test_valid_username(self):
        assert validate_username_format("test_user") == "test_user"

    def test_uppercase_lowered(self):
        assert validate_username_format("JohnDoe") == "johndoe"

    def test_mixed_case_with_underscore(self):
        assert validate_username_format("Test_User_123") == "test_user_123"

    def test_too_short(self):
        with pytest.raises(ValueError, match="3 and 30"):
            validate_username_format("ab")

    def test_too_long(self):
        with pytest.raises(ValueError, match="3 and 30"):
            validate_username_format("a" * 31)

    def test_invalid_characters(self):
        with pytest.raises(ValueError, match="letters, numbers, and underscores"):
            validate_username_format("user-name!")

    def test_empty_string(self):
        with pytest.raises(ValueError, match="3 and 30"):
            validate_username_format("")

    def test_spaces_rejected(self):
        with pytest.raises(ValueError, match="letters, numbers, and underscores"):
            validate_username_format("user name")

    def test_dots_rejected(self):
        with pytest.raises(ValueError, match="letters, numbers, and underscores"):
            validate_username_format("user.name")

    def test_edge_case_min_length(self):
        assert validate_username_format("abc") == "abc"

    def test_edge_case_max_length(self):
        assert validate_username_format("a" * 30) == "a" * 30

    def test_only_underscores(self):
        assert validate_username_format("__hello__") == "__hello__"

    def test_leading_trailing_whitespace_not_stripped(self):
        with pytest.raises(ValueError, match="letters, numbers, and underscores"):
            validate_username_format(" user ")
