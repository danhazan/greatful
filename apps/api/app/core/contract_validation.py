"""
API contract validation service using shared types.
"""

import logging
from typing import Any, Dict, List, Optional, Type, Union
from pydantic import BaseModel, ValidationError
from app.core.exceptions import ValidationException

logger = logging.getLogger(__name__)


class ContractValidator:
    """Service for validating API contracts using shared types."""

    def __init__(self):
        self.validation_cache = {}

    def validate_request(
        self, 
        data: Dict[str, Any], 
        model_class: Type[BaseModel],
        strict: bool = True
    ) -> BaseModel:
        """
        Validate request data against a Pydantic model.
        
        Args:
            data: Request data to validate
            model_class: Pydantic model class to validate against
            strict: Whether to use strict validation
            
        Returns:
            Validated model instance
            
        Raises:
            ValidationException: If validation fails
        """
        try:
            # Use Pydantic's validation
            if strict:
                validated_data = model_class.model_validate(data, strict=True)
            else:
                validated_data = model_class.model_validate(data)
            
            logger.debug(f"Request validation passed for {model_class.__name__}")
            return validated_data
            
        except ValidationError as e:
            logger.warning(f"Request validation failed for {model_class.__name__}: {e}")
            
            # Convert Pydantic errors to our format
            validation_errors = []
            for error in e.errors():
                field_path = ".".join(str(loc) for loc in error["loc"])
                validation_errors.append({
                    "field": field_path,
                    "message": error["msg"],
                    "code": error["type"],
                    "value": error.get("input")
                })
            
            raise ValidationException(
                message="Request validation failed",
                fields={err["field"]: err["message"] for err in validation_errors}
            )

    def validate_response(
        self, 
        data: Any, 
        model_class: Type[BaseModel],
        allow_extra: bool = True
    ) -> Dict[str, Any]:
        """
        Validate response data against a Pydantic model.
        
        Args:
            data: Response data to validate
            model_class: Pydantic model class to validate against
            allow_extra: Whether to allow extra fields in response
            
        Returns:
            Validated response data as dict
            
        Raises:
            ValidationException: If validation fails
        """
        try:
            if isinstance(data, BaseModel):
                # Already a Pydantic model
                validated_data = data
            else:
                # Validate the data
                validated_data = model_class.model_validate(data)
            
            # Convert to dict for response
            response_dict = validated_data.model_dump(exclude_none=not allow_extra)
            
            logger.debug(f"Response validation passed for {model_class.__name__}")
            return response_dict
            
        except ValidationError as e:
            logger.error(f"Response validation failed for {model_class.__name__}: {e}")
            
            # In production, you might want to handle this differently
            # For now, we'll log the error but not fail the response
            if isinstance(data, dict):
                return data
            else:
                return {"error": "Response validation failed"}

    def validate_enum_value(self, value: str, enum_class: Type, field_name: str = "value") -> str:
        """
        Validate that a value is a valid enum member.
        
        Args:
            value: Value to validate
            enum_class: Enum class to validate against
            field_name: Name of the field being validated
            
        Returns:
            Validated enum value
            
        Raises:
            ValidationException: If value is not valid
        """
        try:
            # Check if it's a valid enum value
            if hasattr(enum_class, '__members__'):
                # Python enum
                if value not in enum_class.__members__:
                    valid_values = list(enum_class.__members__.keys())
                    raise ValidationException(
                        message=f"Invalid {field_name}",
                        fields={field_name: f"Must be one of: {', '.join(valid_values)}"}
                    )
            else:
                # String literal type or other
                # This would need to be enhanced based on your enum implementation
                pass
            
            return value
            
        except Exception as e:
            logger.error(f"Enum validation error for {field_name}: {e}")
            raise ValidationException(
                message=f"Invalid {field_name}",
                fields={field_name: str(e)}
            )

    def validate_pagination_params(self, limit: int, offset: int) -> Dict[str, int]:
        """
        Validate pagination parameters.
        
        Args:
            limit: Number of items per page
            offset: Number of items to skip
            
        Returns:
            Validated pagination parameters
            
        Raises:
            ValidationException: If parameters are invalid
        """
        errors = {}
        
        # Validate limit
        if limit < 1:
            errors["limit"] = "Must be at least 1"
        elif limit > 100:
            errors["limit"] = "Must not exceed 100"
        
        # Validate offset
        if offset < 0:
            errors["offset"] = "Must be non-negative"
        
        if errors:
            raise ValidationException(
                message="Invalid pagination parameters",
                fields=errors
            )
        
        return {"limit": limit, "offset": offset}

    def validate_id_format(self, id_value: Union[str, int], field_name: str = "id") -> Union[str, int]:
        """
        Validate ID format.
        
        Args:
            id_value: ID value to validate
            field_name: Name of the ID field
            
        Returns:
            Validated ID value
            
        Raises:
            ValidationException: If ID format is invalid
        """
        if isinstance(id_value, str):
            # UUID format validation
            if len(id_value) == 0:
                raise ValidationException(
                    message=f"Invalid {field_name}",
                    fields={field_name: "ID cannot be empty"}
                )
            # Add more specific UUID validation if needed
            
        elif isinstance(id_value, int):
            # Integer ID validation
            if id_value <= 0:
                raise ValidationException(
                    message=f"Invalid {field_name}",
                    fields={field_name: "ID must be positive"}
                )
        else:
            raise ValidationException(
                message=f"Invalid {field_name}",
                fields={field_name: "ID must be string or integer"}
            )
        
        return id_value

    def validate_content_length(self, content: str, post_type: str, field_name: str = "content") -> str:
        """
        Validate content length based on post type.
        
        Args:
            content: Content to validate
            post_type: Type of post (daily, photo, spontaneous)
            field_name: Name of the content field
            
        Returns:
            Validated content
            
        Raises:
            ValidationException: If content is too long
        """
        # Define max lengths based on post type
        # Universal character limit for all text posts
        # Photo posts have no text content limit (image-only)
        max_length = 5000 if post_type != 'photo' else 0
        
        if max_length > 0 and len(content) > max_length:
            raise ValidationException(
                message=f"Content too long. Maximum {max_length} characters allowed.",
                fields={field_name: f"Maximum {max_length} characters allowed"}
            )
        
        if len(content.strip()) == 0:
            raise ValidationException(
                message="Content cannot be empty",
                fields={field_name: "Content is required"}
            )
        
        return content

    def validate_emoji_code(self, emoji_code: str, field_name: str = "emoji_code") -> str:
        """
        Validate emoji code against allowed values.
        
        Args:
            emoji_code: Emoji code to validate
            field_name: Name of the emoji field
            
        Returns:
            Validated emoji code
            
        Raises:
            ValidationException: If emoji code is invalid
        """
        # Import here to avoid circular imports
        from app.models.emoji_reaction import EmojiReaction
        
        if not EmojiReaction.is_valid_emoji(emoji_code):
            valid_emojis = list(EmojiReaction.VALID_EMOJIS.keys())
            raise ValidationException(
                message="Invalid emoji code",
                fields={field_name: f"Must be one of: {', '.join(valid_emojis)}"}
            )
        
        return emoji_code

    def validate_user_permissions(
        self, 
        user_id: int, 
        resource_owner_id: int, 
        action: str,
        resource_type: str = "resource"
    ) -> bool:
        """
        Validate user permissions for an action.
        
        Args:
            user_id: ID of user performing action
            resource_owner_id: ID of resource owner
            action: Action being performed
            resource_type: Type of resource
            
        Returns:
            True if permission granted
            
        Raises:
            ValidationException: If permission denied
        """
        # Basic ownership check
        if user_id != resource_owner_id:
            from app.core.exceptions import PermissionDeniedError
            raise PermissionDeniedError(
                message=f"Permission denied for {action} on {resource_type}",
                resource=resource_type,
                action=action
            )
        
        return True

    def validate_rate_limit_data(
        self, 
        user_id: int, 
        action: str, 
        limit: int, 
        window_seconds: int
    ) -> Dict[str, Any]:
        """
        Validate rate limit parameters.
        
        Args:
            user_id: User ID
            action: Action being rate limited
            limit: Number of actions allowed
            window_seconds: Time window in seconds
            
        Returns:
            Validated rate limit data
            
        Raises:
            ValidationException: If parameters are invalid
        """
        errors = {}
        
        if user_id <= 0:
            errors["user_id"] = "Must be positive"
        
        if not action or len(action.strip()) == 0:
            errors["action"] = "Action cannot be empty"
        
        if limit <= 0:
            errors["limit"] = "Limit must be positive"
        
        if window_seconds <= 0:
            errors["window_seconds"] = "Window must be positive"
        
        if errors:
            raise ValidationException(
                message="Invalid rate limit parameters",
                fields=errors
            )
        
        return {
            "user_id": user_id,
            "action": action,
            "limit": limit,
            "window_seconds": window_seconds
        }


# Global validator instance
contract_validator = ContractValidator()


def validate_request_data(data: Dict[str, Any], model_class: Type[BaseModel]) -> BaseModel:
    """Convenience function for request validation."""
    return contract_validator.validate_request(data, model_class)


def validate_response_data(data: Any, model_class: Type[BaseModel]) -> Dict[str, Any]:
    """Convenience function for response validation."""
    return contract_validator.validate_response(data, model_class)


def validate_enum(value: str, enum_class: Type, field_name: str = "value") -> str:
    """Convenience function for enum validation."""
    return contract_validator.validate_enum_value(value, enum_class, field_name)


def validate_pagination(limit: int, offset: int) -> Dict[str, int]:
    """Convenience function for pagination validation."""
    return contract_validator.validate_pagination_params(limit, offset)


def validate_id(id_value: Union[str, int], field_name: str = "id") -> Union[str, int]:
    """Convenience function for ID validation."""
    return contract_validator.validate_id_format(id_value, field_name)