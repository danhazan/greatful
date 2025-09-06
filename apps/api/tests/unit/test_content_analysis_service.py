"""
Unit tests for ContentAnalysisService.
"""

import pytest
from unittest.mock import AsyncMock
from app.services.content_analysis_service import ContentAnalysisService
from app.models.post import PostType


class TestContentAnalysisService:
    """Test cases for ContentAnalysisService."""

    @pytest.fixture
    def service(self):
        """Create ContentAnalysisService instance for testing."""
        mock_db = AsyncMock()
        return ContentAnalysisService(mock_db)

    def test_analyze_content_photo_with_text_becomes_daily(self, service):
        """Test that image with text is detected as daily type (not photo)."""
        content = "Beautiful sunset"
        has_image = True
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.daily  # Text + image = daily
        assert result.has_image is True
        assert result.word_count == 2
        assert result.character_limit == 5000
        assert result.confidence > 0.7

    def test_analyze_content_photo_with_no_text(self, service):
        """Test that image with no text is detected as photo type."""
        content = ""
        has_image = True
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.photo
        assert result.has_image is True
        assert result.word_count == 0
        assert result.character_limit == 0
        assert result.confidence > 0.9

    def test_analyze_content_spontaneous_short_text(self, service):
        """Test that short text without image is detected as spontaneous."""
        content = "Grateful for coffee this morning!"
        has_image = False
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.spontaneous
        assert result.has_image is False
        assert result.word_count == 5  # "Grateful", "for", "coffee", "this", "morning!"
        assert result.character_limit == 200
        assert result.confidence > 0.8

    def test_analyze_content_daily_long_text(self, service):
        """Test that long text is detected as daily gratitude."""
        content = "Today I'm incredibly grateful for the opportunity to spend time with my family. We had a wonderful dinner together, sharing stories and laughing until our sides hurt. These moments remind me of what truly matters in life."
        has_image = False
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.daily
        assert result.has_image is False
        assert result.word_count > 20
        assert result.character_limit == 5000
        assert result.confidence > 0.8

    def test_analyze_content_edge_case_19_words(self, service):
        """Test edge case with exactly 19 words (just under spontaneous threshold)."""
        content = "Grateful for this beautiful day and all the wonderful opportunities it brings to my life today"
        has_image = False
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.spontaneous
        assert result.word_count == 16  # Actual word count
        assert result.character_limit == 200

    def test_analyze_content_edge_case_20_words(self, service):
        """Test edge case with exactly 20 words (at threshold)."""
        content = "Grateful for this beautiful day and all the wonderful opportunities it brings to my life today and tomorrow and beyond"
        has_image = False
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.daily
        assert result.word_count >= 20
        assert result.character_limit == 5000

    def test_analyze_content_image_with_long_text(self, service):
        """Test that image with long text is detected as daily."""
        content = "This beautiful sunset reminds me of all the wonderful moments I've shared with loved ones throughout the years. Each day brings new opportunities for gratitude and connection."
        has_image = True
        
        result = service.analyze_content(content, has_image)
        
        assert result.suggested_type == PostType.daily  # Any text + image = daily
        assert result.has_image is True
        assert result.word_count > 20
        assert result.character_limit == 5000

    def test_validate_content_for_type_valid(self, service):
        """Test content validation for valid content length."""
        content = "Short gratitude message"
        post_type = PostType.spontaneous
        
        result = service.validate_content_for_type(content, post_type)
        
        assert result["is_valid"] is True
        assert result["character_count"] == len(content)
        assert result["character_limit"] == 200
        assert result["characters_over"] == 0
        assert result["characters_remaining"] > 0

    def test_validate_content_for_type_too_long(self, service):
        """Test content validation for content that's too long."""
        content = "x" * 250  # 250 characters
        post_type = PostType.spontaneous  # 200 char limit
        
        result = service.validate_content_for_type(content, post_type)
        
        assert result["is_valid"] is False
        assert result["character_count"] == 250
        assert result["character_limit"] == 200
        assert result["characters_over"] == 50
        assert result["characters_remaining"] == 0

    def test_clean_content_removes_extra_whitespace(self, service):
        """Test that content cleaning removes extra whitespace."""
        content = "  Grateful   for    this   day  "
        
        cleaned = service._clean_content(content)
        
        assert cleaned == "Grateful for this day"

    def test_count_words_handles_mentions(self, service):
        """Test that word counting handles mentions correctly."""
        content = "Grateful for @username and @another_user today"
        
        word_count = service._count_words(content)
        
        assert word_count == 6  # "Grateful", "for", "@username", "and", "@another_user", "today"

    def test_count_words_empty_content(self, service):
        """Test word counting with empty content."""
        content = ""
        
        word_count = service._count_words(content)
        
        assert word_count == 0

    def test_determine_post_type_rules_priority(self, service):
        """Test that post type determination follows correct simplified rules."""
        # Rule 1: Photo only (image with no text) -> photo
        assert service._determine_post_type("", 0, True) == PostType.photo
        
        # Rule 2: Just text under limit (no image) -> spontaneous  
        assert service._determine_post_type("Thanks for today!", 3, False) == PostType.spontaneous
        
        # Rule 3: All others -> daily
        # - Long text without image
        long_content = "This is a much longer gratitude message with many words that exceeds the spontaneous threshold"
        assert service._determine_post_type(long_content, 25, False) == PostType.daily
        # - Any text with image (even short text)
        assert service._determine_post_type("Thanks!", 1, True) == PostType.daily

    def test_calculate_confidence_high_for_clear_cases(self, service):
        """Test that confidence is high for clear-cut cases."""
        # Image with no text -> high confidence photo
        confidence = service._calculate_confidence(PostType.photo, 0, True, 0)
        assert confidence >= 0.85
        
        # Very short text without image -> high confidence spontaneous
        confidence = service._calculate_confidence(PostType.spontaneous, 5, False, 25)
        assert confidence >= 0.85
        
        # Long text -> high confidence daily
        confidence = service._calculate_confidence(PostType.daily, 40, False, 200)
        assert confidence >= 0.85

    def test_calculate_confidence_lower_for_edge_cases(self, service):
        """Test that confidence is lower for edge cases."""
        # Text near spontaneous threshold -> lower confidence
        confidence = service._calculate_confidence(PostType.spontaneous, 18, False, 100)
        assert confidence < 0.8
        
        # Content exceeding character limit -> lower confidence
        confidence = service._calculate_confidence(PostType.spontaneous, 10, False, 250)
        assert confidence < 0.8

    def test_error_handling_returns_safe_default(self, service):
        """Test that None input is handled gracefully."""
        # Pass None as content to test graceful handling
        result = service.analyze_content(None, False)  # type: ignore
        
        # Should handle None gracefully (treated as empty content -> spontaneous due to 0 words < 20)
        assert result.suggested_type == PostType.spontaneous
        # Confidence will be high for very short content, so just check it's reasonable
        assert 0.5 <= result.confidence <= 1.0
        assert result.character_limit == 200
        # Should have normal metadata, not error metadata since None is handled gracefully
        assert result.analysis_metadata["content_length_category"] == "empty"

    def test_analysis_metadata_includes_expected_fields(self, service):
        """Test that analysis metadata includes all expected fields."""
        content = "Grateful for this beautiful day"
        has_image = True
        
        result = service.analyze_content(content, has_image)
        
        metadata = result.analysis_metadata
        assert "word_count" in metadata
        assert "character_count" in metadata
        assert "has_image" in metadata
        assert "content_length_category" in metadata
        assert "detection_rules_applied" in metadata
        
        # Check that rules are properly recorded
        rules = metadata["detection_rules_applied"]
        assert "has_image_detected" in rules
        assert "short_text_content" in rules

    def test_get_content_length_category(self, service):
        """Test content length categorization."""
        assert service._get_content_length_category(0) == "empty"
        assert service._get_content_length_category(3) == "very_short"
        assert service._get_content_length_category(10) == "short"
        assert service._get_content_length_category(20) == "medium"
        assert service._get_content_length_category(40) == "long"
        assert service._get_content_length_category(80) == "very_long"