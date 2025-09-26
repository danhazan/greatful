"""
HTML sanitization utilities for rich content.
"""

import bleach
from typing import Optional

# Allowed HTML tags for rich content
ALLOWED_TAGS = [
    "strong", "b", "em", "i", "u", "span", "br", "p", 
    "ul", "ol", "li", "a"
]

# Allowed attributes for HTML tags
ALLOWED_ATTRIBUTES = {
    "span": ["style", "data-username", "class"],
    "a": ["href", "title"],
    "*": ["class"]  # Allow class on all tags
}

# Allowed CSS properties in style attributes
ALLOWED_STYLES = [
    "color", "background-color", "font-size", "font-weight", 
    "font-style", "text-decoration"
]

def sanitize_html(html_content: Optional[str]) -> Optional[str]:
    """
    Sanitize HTML content to prevent XSS attacks while preserving safe formatting.
    
    Args:
        html_content: Raw HTML content to sanitize
        
    Returns:
        Sanitized HTML content or None if input was None/empty
    """
    if not html_content:
        return html_content
    
    # Use bleach to sanitize HTML
    # Note: bleach 6.x doesn't support the 'styles' parameter directly
    # We'll use a CSS sanitizer instead
    from bleach.css_sanitizer import CSSSanitizer
    
    css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_STYLES)
    
    sanitized = bleach.clean(
        html_content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        css_sanitizer=css_sanitizer,
        strip=True,  # Strip disallowed tags instead of escaping
        strip_comments=True
    )
    
    return sanitized

def strip_html_tags(html_content: Optional[str]) -> str:
    """
    Strip all HTML tags and return plain text.
    
    Args:
        html_content: HTML content to strip
        
    Returns:
        Plain text content
    """
    if not html_content:
        return ""
    
    # Use bleach to strip all HTML tags
    plain_text = bleach.clean(html_content, tags=[], strip=True)
    
    # Clean up extra whitespace
    return " ".join(plain_text.split())