"""
Post style validation utilities.
"""

import re
from typing import Dict, Any, Optional, List
from pydantic import ValidationError


class PostStyleValidator:
    """Validator for post style data to ensure only background color properties are stored."""
    
    # Predefined style IDs that are allowed
    PREDEFINED_STYLE_IDS = {
        'default', 'warm', 'cool', 'nature', 'sunset', 'ocean', 'forest', 
        'lavender', 'rose', 'mint', 'peach', 'sky', 'earth', 'gradient'
    }
    
    # Allowed background color properties
    ALLOWED_BACKGROUND_PROPERTIES = {
        'backgroundColor', 'backgroundGradient', 'backgroundImage', 
        'backgroundOpacity', 'backgroundBlendMode'
    }
    
    # Required fields for post style
    REQUIRED_FIELDS = {'id', 'name', 'backgroundColor'}
    
    @classmethod
    def validate_hex_color(cls, color: str) -> bool:
        """Validate if a string is a valid hex color code."""
        if not isinstance(color, str):
            return False
        
        # Allow 3, 6, or 8 character hex codes (with or without #)
        # Note: 4-character hex codes are not standard, so we exclude them
        hex_pattern = r'^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$'
        return bool(re.match(hex_pattern, color))
    
    @classmethod
    def validate_gradient(cls, gradient: Any) -> bool:
        """Validate gradient object structure."""
        if not isinstance(gradient, dict):
            return False
        
        # Basic gradient validation - should have type and colors
        if 'type' not in gradient or 'colors' not in gradient:
            return False
        
        if gradient['type'] not in ['linear', 'radial']:
            return False
        
        if not isinstance(gradient['colors'], list) or len(gradient['colors']) < 2:
            return False
        
        # Validate each color in the gradient
        for color in gradient['colors']:
            if isinstance(color, str):
                if not cls.validate_hex_color(color):
                    return False
            elif isinstance(color, dict):
                if 'color' not in color or not cls.validate_hex_color(color['color']):
                    return False
            else:
                return False
        
        return True
    
    @classmethod
    def validate_style_id(cls, style_id: str) -> bool:
        """Validate if style ID is either predefined or a valid custom format."""
        if not isinstance(style_id, str):
            return False
        
        # Allow predefined style IDs
        if style_id in cls.PREDEFINED_STYLE_IDS:
            return True
        
        # Allow custom style IDs with format: custom-{uuid} or user-{id}-{name}
        custom_pattern = r'^(custom-[a-f0-9-]{36}|user-\d+-[a-zA-Z0-9_-]+)$'
        return bool(re.match(custom_pattern, style_id))
    
    @classmethod
    def clean_post_style(cls, post_style: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean post style data by removing font-related properties and keeping only 
        background color properties for backward compatibility.
        """
        if not isinstance(post_style, dict):
            return post_style
        
        cleaned_style = {}
        
        # Always preserve required fields
        for field in cls.REQUIRED_FIELDS:
            if field in post_style:
                cleaned_style[field] = post_style[field]
        
        # Preserve allowed background properties
        for prop in cls.ALLOWED_BACKGROUND_PROPERTIES:
            if prop in post_style:
                cleaned_style[prop] = post_style[prop]
        
        # Remove font-related properties (for backward compatibility)
        font_properties = {
            'textColor', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
            'textAlign', 'lineHeight', 'letterSpacing', 'textDecoration',
            'textShadow', 'color'  # 'color' is often used for text color
        }
        
        # Log removed properties for debugging (in development)
        removed_props = set(post_style.keys()) - set(cleaned_style.keys())
        if removed_props:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Removed font-related properties from post_style: {removed_props}")
        
        return cleaned_style
    
    @classmethod
    def validate_post_style(cls, post_style: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate and clean post style data.
        
        Args:
            post_style: The post style dictionary to validate
            
        Returns:
            Cleaned and validated post style dictionary
            
        Raises:
            ValueError: If validation fails
        """
        if post_style is None:
            return None
        
        if not isinstance(post_style, dict):
            raise ValueError("Post style must be a dictionary")
        
        # Clean the post style first (remove font properties)
        cleaned_style = cls.clean_post_style(post_style)
        
        # Validate required fields
        missing_fields = cls.REQUIRED_FIELDS - set(cleaned_style.keys())
        if missing_fields:
            raise ValueError(f"Post style missing required fields: {', '.join(missing_fields)}")
        
        # Validate style ID
        if not cls.validate_style_id(cleaned_style['id']):
            raise ValueError(f"Invalid style ID: {cleaned_style['id']}. Must be a predefined style or custom format.")
        
        # Validate name
        if not isinstance(cleaned_style['name'], str) or not cleaned_style['name'].strip():
            raise ValueError("Style name must be a non-empty string")
        
        # Validate backgroundColor
        bg_color = cleaned_style['backgroundColor']
        if isinstance(bg_color, str):
            # Single color - validate hex
            if not cls.validate_hex_color(bg_color):
                raise ValueError(f"Invalid background color hex code: {bg_color}")
        elif isinstance(bg_color, dict):
            # Gradient - validate gradient structure
            if not cls.validate_gradient(bg_color):
                raise ValueError("Invalid background gradient format")
        else:
            raise ValueError("Background color must be a hex string or gradient object")
        
        # Validate optional background properties
        if 'backgroundGradient' in cleaned_style:
            if not cls.validate_gradient(cleaned_style['backgroundGradient']):
                raise ValueError("Invalid background gradient format")
        
        if 'backgroundOpacity' in cleaned_style:
            opacity = cleaned_style['backgroundOpacity']
            if not isinstance(opacity, (int, float)) or not (0 <= opacity <= 1):
                raise ValueError("Background opacity must be a number between 0 and 1")
        
        if 'backgroundBlendMode' in cleaned_style:
            valid_blend_modes = {
                'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
                'color-dodge', 'color-burn', 'hard-light', 'soft-light',
                'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
            }
            if cleaned_style['backgroundBlendMode'] not in valid_blend_modes:
                raise ValueError(f"Invalid background blend mode: {cleaned_style['backgroundBlendMode']}")
        
        return cleaned_style
    
    @classmethod
    def get_validation_errors(cls, post_style: Optional[Dict[str, Any]]) -> List[str]:
        """
        Get a list of validation errors without raising exceptions.
        
        Args:
            post_style: The post style dictionary to validate
            
        Returns:
            List of validation error messages
        """
        try:
            cls.validate_post_style(post_style)
            return []
        except ValueError as e:
            return [str(e)]
        except Exception as e:
            return [f"Unexpected validation error: {str(e)}"]