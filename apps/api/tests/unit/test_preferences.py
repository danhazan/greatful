import pytest
from app.api.v1.users import PreferencesUpdate

class TestPreferencesUpdate:
    def test_valid_regional_date_format(self):
        update = PreferencesUpdate(regional_date_format="MM/DD/YYYY")
        assert update.regional_date_format == "MM/DD/YYYY"

    def test_none_regional_date_format(self):
        update = PreferencesUpdate(regional_date_format=None)
        assert update.regional_date_format is None

    def test_optional_fields(self):
        update = PreferencesUpdate()
        assert update.regional_date_format is None
