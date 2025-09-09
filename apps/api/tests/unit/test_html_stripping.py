"""
Test HTML stripping functionality in notification factory.
"""

import pytest
from app.core.notification_factory import _strip_html_tags


class TestHtmlStripping:
    """Test HTML tag stripping for notifications."""

    def test_strip_mention_spans(self):
        """Test stripping mention spans from HTML content."""
        html_content = '<span class="mention" data-username="Bob">@Bob</span> hello world'
        result = _strip_html_tags(html_content)
        assert result == '@Bob hello world'

    def test_strip_multiple_tags(self):
        """Test stripping multiple HTML tags."""
        html_content = 'Hello <strong>world</strong> with <em>emphasis</em> and <span>spans</span>'
        result = _strip_html_tags(html_content)
        assert result == 'Hello world with emphasis and spans'

    def test_decode_html_entities(self):
        """Test decoding HTML entities."""
        html_content = '<span>&lt;test&gt; &amp; &quot;quotes&quot;</span>'
        result = _strip_html_tags(html_content)
        assert result == '<test> & "quotes"'

    def test_clean_whitespace(self):
        """Test cleaning up extra whitespace."""
        html_content = '<p>  Multiple   spaces  </p>  <div>  and   newlines  </div>'
        result = _strip_html_tags(html_content)
        assert result == 'Multiple spaces and newlines'

    def test_empty_string(self):
        """Test handling empty string."""
        result = _strip_html_tags('')
        assert result == ''

    def test_none_input(self):
        """Test handling None input."""
        result = _strip_html_tags(None)
        assert result == ''

    def test_plain_text_unchanged(self):
        """Test that plain text without HTML is unchanged."""
        plain_text = 'This is plain text without any HTML'
        result = _strip_html_tags(plain_text)
        assert result == plain_text

    def test_complex_mention_notification(self):
        """Test realistic mention notification content."""
        html_content = 'Thanks <span class="mention" data-username="Alice">@Alice</span> for the help with <strong>project</strong>!'
        result = _strip_html_tags(html_content)
        assert result == 'Thanks @Alice for the help with project!'

    def test_nested_tags(self):
        """Test handling nested HTML tags."""
        html_content = '<div><p>Nested <span><strong>tags</strong></span> here</p></div>'
        result = _strip_html_tags(html_content)
        assert result == 'Nested tags here'

    def test_self_closing_tags(self):
        """Test handling self-closing tags."""
        html_content = 'Line one<br/>Line two<hr/>Line three'
        result = _strip_html_tags(html_content)
        assert result == 'Line oneLine twoLine three'