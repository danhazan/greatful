"""
Decorators for API contract validation.
"""

import functools
import logging
from typing import Any, Callable, Dict, List, Optional, Type, TypeVar
from fastapi import Request, HTTPException, status
from pydantic import BaseModel, ValidationError
from app.core.contract_validation import contract_validator
from app.core.exceptions import ValidationException

logger = logging.getLogger(__name__)

F = TypeVar('F', bound=Callable[..., Any])


def validate_request_body(model_class: Type[BaseModel], strict: bool = True):
    """
    Decorator to validate request body against a Pydantic model.
    
    Args:
        model_class: Pydantic model class to validate against
        strict: Whether to use strict validation
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the request body in kwargs
            request_body = None
            for key, value in kwargs.items():
                if isinstance(value, dict) and key not in ['db', 'current_user_id']:
                    request_body = value
                    break
            
            if request_body is not None:
                try:
                    # Validate the request body
                    validated_data = contract_validator.validate_request(
                        request_body, model_class, strict
                    )
                    
                    # Replace the original data with validated data
                    for key, value in kwargs.items():
                        if value is request_body:
                            kwargs[key] = validated_data
                            break
                            
                except ValidationException as e:
                    logger.warning(f"Request validation failed in {func.__name__}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=e.detail
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_response_body(model_class: Type[BaseModel], allow_extra: bool = True):
    """
    Decorator to validate response body against a Pydantic model.
    
    Args:
        model_class: Pydantic model class to validate against
        allow_extra: Whether to allow extra fields in response
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            try:
                # Validate the response
                validated_response = contract_validator.validate_response(
                    result, model_class, allow_extra
                )
                return validated_response
                
            except Exception as e:
                logger.error(f"Response validation failed in {func.__name__}: {e}")
                # In production, you might want to handle this differently
                # For now, return the original response
                return result
        
        return wrapper
    return decorator


def validate_enum_param(param_name: str, enum_class: Type):
    """
    Decorator to validate enum parameters.
    
    Args:
        param_name: Name of the parameter to validate
        enum_class: Enum class to validate against
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            if param_name in kwargs:
                try:
                    validated_value = contract_validator.validate_enum_value(
                        kwargs[param_name], enum_class, param_name
                    )
                    kwargs[param_name] = validated_value
                    
                except ValidationException as e:
                    logger.warning(f"Enum validation failed in {func.__name__}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=e.detail
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_pagination_params():
    """
    Decorator to validate pagination parameters (limit and offset).
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            limit = kwargs.get('limit', 20)
            offset = kwargs.get('offset', 0)
            
            try:
                validated_params = contract_validator.validate_pagination_params(limit, offset)
                kwargs.update(validated_params)
                
            except ValidationException as e:
                logger.warning(f"Pagination validation failed in {func.__name__}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=e.detail
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_id_param(param_name: str = "id"):
    """
    Decorator to validate ID parameters.
    
    Args:
        param_name: Name of the ID parameter to validate
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            if param_name in kwargs:
                try:
                    validated_id = contract_validator.validate_id_format(
                        kwargs[param_name], param_name
                    )
                    kwargs[param_name] = validated_id
                    
                except ValidationException as e:
                    logger.warning(f"ID validation failed in {func.__name__}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=e.detail
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_content_length(post_type_param: str = "post_type", content_param: str = "content"):
    """
    Decorator to validate content length based on post type.
    
    Args:
        post_type_param: Name of the post type parameter
        content_param: Name of the content parameter
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Look for post_type and content in kwargs or in request body
            post_type = kwargs.get(post_type_param)
            content = kwargs.get(content_param)
            
            # If not in kwargs, look in request body objects
            if not post_type or not content:
                for key, value in kwargs.items():
                    if isinstance(value, dict):
                        post_type = post_type or value.get(post_type_param)
                        content = content or value.get(content_param)
                    elif hasattr(value, post_type_param) and hasattr(value, content_param):
                        post_type = post_type or getattr(value, post_type_param)
                        content = content or getattr(value, content_param)
            
            if post_type and content:
                try:
                    contract_validator.validate_content_length(content, post_type, content_param)
                    
                except ValidationException as e:
                    logger.warning(f"Content length validation failed in {func.__name__}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=e.detail
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_user_permissions(resource_owner_param: str = "author_id", action: str = "access"):
    """
    Decorator to validate user permissions.
    
    Args:
        resource_owner_param: Name of the resource owner ID parameter
        action: Action being performed
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_user_id = kwargs.get('current_user_id')
            resource_owner_id = kwargs.get(resource_owner_param)
            
            if current_user_id and resource_owner_id:
                try:
                    contract_validator.validate_user_permissions(
                        current_user_id, resource_owner_id, action
                    )
                    
                except Exception as e:
                    logger.warning(f"Permission validation failed in {func.__name__}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=str(e)
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_rate_limit(action: str, limit: int, window_seconds: int = 3600):
    """
    Decorator to validate rate limit parameters.
    
    Args:
        action: Action being rate limited
        limit: Number of actions allowed
        window_seconds: Time window in seconds
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_user_id = kwargs.get('current_user_id')
            
            if current_user_id:
                try:
                    contract_validator.validate_rate_limit_data(
                        current_user_id, action, limit, window_seconds
                    )
                    
                except ValidationException as e:
                    logger.warning(f"Rate limit validation failed in {func.__name__}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=e.detail
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def contract_validated(
    request_model: Optional[Type[BaseModel]] = None,
    response_model: Optional[Type[BaseModel]] = None,
    validate_enums: Optional[Dict[str, Type]] = None,
    validate_ids: Optional[List[str]] = None,
    validate_pagination: bool = False,
    validate_content: bool = False,
    validate_permissions: Optional[str] = None,
    rate_limit: Optional[Dict[str, Any]] = None
):
    """
    Comprehensive contract validation decorator.
    
    Args:
        request_model: Pydantic model for request validation
        response_model: Pydantic model for response validation
        validate_enums: Dict of parameter names to enum classes
        validate_ids: List of ID parameter names to validate
        validate_pagination: Whether to validate pagination parameters
        validate_content: Whether to validate content length
        validate_permissions: Resource owner parameter name for permission validation
        rate_limit: Rate limit configuration dict
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Apply all validations in order
            
            # Enum validation
            if validate_enums:
                for param_name, enum_class in validate_enums.items():
                    if param_name in kwargs:
                        try:
                            validated_value = contract_validator.validate_enum_value(
                                kwargs[param_name], enum_class, param_name
                            )
                            kwargs[param_name] = validated_value
                        except ValidationException as e:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=e.detail
                            )
            
            # ID validation
            if validate_ids:
                for id_param in validate_ids:
                    if id_param in kwargs:
                        try:
                            validated_id = contract_validator.validate_id_format(
                                kwargs[id_param], id_param
                            )
                            kwargs[id_param] = validated_id
                        except ValidationException as e:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=e.detail
                            )
            
            # Pagination validation
            if validate_pagination:
                limit = kwargs.get('limit', 20)
                offset = kwargs.get('offset', 0)
                try:
                    validated_params = contract_validator.validate_pagination_params(limit, offset)
                    kwargs.update(validated_params)
                except ValidationException as e:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=e.detail
                    )
            
            # Request body validation
            if request_model:
                request_body = None
                for key, value in kwargs.items():
                    if isinstance(value, dict) and key not in ['db', 'current_user_id']:
                        request_body = value
                        break
                
                if request_body is not None:
                    try:
                        validated_data = contract_validator.validate_request(
                            request_body, request_model
                        )
                        for key, value in kwargs.items():
                            if value is request_body:
                                kwargs[key] = validated_data
                                break
                    except ValidationException as e:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=e.detail
                        )
            
            # Execute the function
            result = await func(*args, **kwargs)
            
            # Response validation
            if response_model:
                try:
                    validated_response = contract_validator.validate_response(
                        result, response_model
                    )
                    return validated_response
                except Exception as e:
                    logger.error(f"Response validation failed in {func.__name__}: {e}")
                    return result
            
            return result
        
        return wrapper
    return decorator