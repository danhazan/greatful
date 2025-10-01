"""
Unit tests for PostStyleValidator.
"""

import pytest
from app.utils.post_style_validator import PostStyleValidator


class TestPostStyleValidator:
    """Test cases for PostStyleValidator."""
    
    def test_validate_hex_color_valid(self):
        """Test validation of valid hex colors."""
        valid_colors = [
            "#FF0000",  # 6-digit with #
            "FF0000",   # 6-digit without #
            "#F00",     # 3-digit with #
            "F00",      # 3-digit without #
            "#FF0000FF", # 8-digit with alpha
            "FF0000FF",  # 8-digit without alpha
            "f00",      # lowercase
        ]
        
        for color in valid_colors:
            assert PostStyleValidator.validate_hex_color(color), f"Should be valid: {color}"
    
    def test_validate_hex_color_invalid(self):
        """Test validation of invalid hex colors."""
        invalid_colors = [
            "GG0000",   # Invalid hex characters
            "#GG0000",  # Invalid hex characters with #
            "FF00",     # Wrong length (4 chars)
            "FF000",    # Wrong length (5 chars)
            "#FF00000", # Wrong length (7 chars)
            "",         # Empty string
            "#",        # Just hash
            "rgb(255,0,0)", # CSS rgb format
            123,        # Not a string
            None,       # None value
        ]
        
        for color in invalid_colors:
            assert not PostStyleValidator.validate_hex_color(color), f"Should be invalid: {color}"
    
    def test_validate_gradient_valid(self):
        """Test validation of valid gradient objects."""
        valid_gradients = [
            {
                "type": "linear",
                "colors": ["#FF0000", "#00FF00"]
            },
            {
                "type": "radial",
                "colors": [
                    {"color": "#FF0000", "stop": 0},
                    {"color": "#00FF00", "stop": 1}
                ]
            },
            {
                "type": "linear",
                "colors": ["#FF0000", "#00FF00", "#0000FF"],
                "direction": "45deg"
            }
        ]
        
        for gradient in valid_gradients:
            assert PostStyleValidator.validate_gradient(gradient), f"Should be valid: {gradient}"
    
    def test_validate_gradient_invalid(self):
        """Test validation of invalid gradient objects."""
        invalid_gradients = [
            {"type": "linear"},  # Missing colors
            {"colors": ["#FF0000", "#00FF00"]},  # Missing type
            {"type": "invalid", "colors": ["#FF0000", "#00FF00"]},  # Invalid type
            {"type": "linear", "colors": ["#FF0000"]},  # Too few colors
            {"type": "linear", "colors": ["invalid", "#00FF00"]},  # Invalid color
            {"type": "linear", "colors": [{"color": "invalid"}]},  # Invalid color in object
            "not a dict",  # Not a dictionary
            None,  # None value
        ]
        
        for gradient in invalid_gradients:
            assert not PostStyleValidator.validate_gradient(gradient), f"Should be invalid: {gradient}"
    
    def test_validate_style_id_predefined(self):
        """Test validation of predefined style IDs."""
        predefined_ids = ['default', 'warm', 'cool', 'nature', 'sunset', 'ocean']
        
        for style_id in predefined_ids:
            assert PostStyleValidator.validate_style_id(style_id), f"Should be valid: {style_id}"
    
    def test_validate_style_id_custom(self):
        """Test validation of custom style IDs."""
        valid_custom_ids = [
            "custom-12345678-1234-1234-1234-123456789abc",
            "user-123-my-style",
            "user-456-another_style",
            # Common style patterns
            "nature-green",
            "warm-orange", 
            "cool_blue",
            "multi-word-style",
            "valid123",
            "singleword"
        ]
        
        for style_id in valid_custom_ids:
            assert PostStyleValidator.validate_style_id(style_id), f"Should be valid: {style_id}"
    
    def test_validate_style_id_invalid(self):
        """Test validation of invalid style IDs."""
        invalid_ids = [
            "",
            None,
            123,
            # Invalid patterns
            "invalid--style",  # Double dash
            "invalid__style",  # Double underscore
            "style-",          # Ends with dash
            "-style",          # Starts with dash
            "123invalid",      # Starts with number
        ]
        
        for style_id in invalid_ids:
            assert not PostStyleValidator.validate_style_id(style_id), f"Should be invalid: {style_id}"
    
    def test_clean_post_style_removes_font_properties(self):
        """Test that font-related properties are removed."""
        original_style = {
            "id": "default",
            "name": "Default Style",
            "backgroundColor": "#FFFFFF",
            "textColor": "#000000",  # Should be removed
            "fontSize": "16px",      # Should be removed
            "fontFamily": "Arial",   # Should be removed
            "backgroundOpacity": 0.8,  # Should be kept
        }
        
        cleaned = PostStyleValidator.clean_post_style(original_style)
        
        # Should keep required and allowed properties
        assert "id" in cleaned
        assert "name" in cleaned
        assert "backgroundColor" in cleaned
        assert "backgroundOpacity" in cleaned
        
        # Should remove font properties
        assert "textColor" not in cleaned
        assert "fontSize" not in cleaned
        assert "fontFamily" not in cleaned
    
    def test_clean_post_style_preserves_background_properties(self):
        """Test that background properties are preserved."""
        original_style = {
            "id": "gradient",
            "name": "Gradient Style",
            "backgroundColor": {"type": "linear", "colors": ["#FF0000", "#00FF00"]},
            "backgroundGradient": {"type": "radial", "colors": ["#0000FF", "#FFFF00"]},
            "backgroundOpacity": 0.9,
            "backgroundBlendMode": "multiply",
            "textColor": "#FFFFFF",  # Should be removed
        }
        
        cleaned = PostStyleValidator.clean_post_style(original_style)
        
        # Should keep all background properties
        assert cleaned["backgroundColor"] == original_style["backgroundColor"]
        assert cleaned["backgroundGradient"] == original_style["backgroundGradient"]
        assert cleaned["backgroundOpacity"] == original_style["backgroundOpacity"]
        assert cleaned["backgroundBlendMode"] == original_style["backgroundBlendMode"]
        
        # Should remove text properties
        assert "textColor" not in cleaned
    
    def test_validate_post_style_valid(self):
        """Test validation of valid post styles."""
        valid_styles = [
            {
                "id": "default",
                "name": "Default Style",
                "backgroundColor": "#FFFFFF"
            },
            {
                "id": "gradient",
                "name": "Gradient Style",
                "backgroundColor": {"type": "linear", "colors": ["#FF0000", "#00FF00"]},
                "backgroundOpacity": 0.8
            },
            {
                "id": "custom-12345678-1234-1234-1234-123456789abc",
                "name": "Custom Style",
                "backgroundColor": "#FF5733",
                "backgroundBlendMode": "overlay"
            }
        ]
        
        for style in valid_styles:
            result = PostStyleValidator.validate_post_style(style)
            assert result is not None
            assert result["id"] == style["id"]
            assert result["name"] == style["name"]
    
    def test_validate_post_style_invalid(self):
        """Test validation of invalid post styles."""
        invalid_styles = [
            None,  # None is valid (returns None)
            "not a dict",  # Not a dictionary
            {},  # Missing required fields
            {"id": "default"},  # Missing name and backgroundColor
            {"id": "", "name": "Test", "backgroundColor": "#FF0000"},  # Empty ID
            {"id": "default", "name": "", "backgroundColor": "#FF0000"},  # Empty name
            {"id": "default", "name": "Test", "backgroundColor": "invalid"},  # Invalid color
            {"id": "default", "name": "Test", "backgroundColor": "#FF0000", "backgroundOpacity": 2},  # Invalid opacity
        ]
        
        for style in invalid_styles[1:]:  # Skip None which is valid
            with pytest.raises(ValueError):
                PostStyleValidator.validate_post_style(style)
        
        # Test None separately (should return None, not raise)
        assert PostStyleValidator.validate_post_style(None) is None
    
    def test_validate_post_style_cleans_font_properties(self):
        """Test that validation automatically cleans font properties."""
        style_with_fonts = {
            "id": "default",
            "name": "Test Style",
            "backgroundColor": "#FFFFFF",
            "textColor": "#000000",  # Should be removed
            "fontSize": "16px",      # Should be removed
            "fontWeight": "bold",    # Should be removed
        }
        
        result = PostStyleValidator.validate_post_style(style_with_fonts)
        
        # Should keep required properties
        assert result["id"] == "default"
        assert result["name"] == "Test Style"
        assert result["backgroundColor"] == "#FFFFFF"
        
        # Should remove font properties
        assert "textColor" not in result
        assert "fontSize" not in result
        assert "fontWeight" not in result
    
    def test_get_validation_errors(self):
        """Test getting validation errors without exceptions."""
        valid_style = {
            "id": "default",
            "name": "Test Style",
            "backgroundColor": "#FFFFFF"
        }
        
        invalid_style = {
            "id": "",  # Empty ID should be invalid
            "name": "Test Style",
            "backgroundColor": "#FFFFFF"
        }
        
        # Valid style should have no errors
        errors = PostStyleValidator.get_validation_errors(valid_style)
        assert len(errors) == 0
        
        # Invalid style should have errors
        errors = PostStyleValidator.get_validation_errors(invalid_style)
        assert len(errors) > 0
        assert any("Invalid style ID" in error for error in errors)
    
    def test_background_blend_mode_validation(self):
        """Test validation of background blend modes."""
        valid_blend_modes = [
            'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
            'color-dodge', 'color-burn', 'hard-light', 'soft-light',
            'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
        ]
        
        for blend_mode in valid_blend_modes:
            style = {
                "id": "default",
                "name": "Test Style",
                "backgroundColor": "#FFFFFF",
                "backgroundBlendMode": blend_mode
            }
            result = PostStyleValidator.validate_post_style(style)
            assert result["backgroundBlendMode"] == blend_mode
        
        # Test invalid blend mode
        invalid_style = {
            "id": "default",
            "name": "Test Style",
            "backgroundColor": "#FFFFFF",
            "backgroundBlendMode": "invalid-mode"
        }
        
        with pytest.raises(ValueError, match="Invalid background blend mode"):
            PostStyleValidator.validate_post_style(invalid_style)