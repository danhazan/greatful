"""
Input sanitization middleware and utilities for user-generated content security.
"""

import os
import re
import html
import json
import logging
from typing import Any, Dict, List, Optional, Union
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import FormData
import bleach

logger = logging.getLogger(__name__)


class InputSanitizer:
    """
    Comprehensive input sanitization for user-generated content.
    """
    
    # Allowed HTML tags for rich content (very restrictive)
    ALLOWED_TAGS = [
        'p', 'br', 'strong', 'em', 'u', 'a'
    ]
    
    # Allowed HTML attributes
    ALLOWED_ATTRIBUTES = {
        'a': ['href', 'title'],
    }
    
    # Allowed URL schemes
    ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']
    
    # Maximum lengths for different field types
    MAX_LENGTHS = {
        'username': 50,
        'email': 254,
        'bio': 500,
        'post_content': 2000,
        'display_name': 100,
        'city': 100,
        'institution': 200,
        'website': 500,
        'search_query': 100,
        'notification_message': 1000,
    }
    
    # Patterns for validation
    PATTERNS = {
        'username': re.compile(r'^[a-zA-Z0-9_.-]+$'),
        'email': re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
        'url': re.compile(r'^https?://[^\s/$.?#].[^\s]*$', re.IGNORECASE),
        'mention': re.compile(r'@([a-zA-Z0-9_.-]+)'),
        'hashtag': re.compile(r'#([a-zA-Z0-9_]+)'),
    }
    
    @classmethod
    def sanitize_text(
        cls, 
        text: str, 
        field_type: str = 'general',
        allow_html: bool = False,
        max_length: Optional[int] = None
    ) -> str:
        """
        Sanitize text input with field-specific rules.
        
        Args:
            text: Input text to sanitize
            field_type: Type of field for specific validation
            allow_html: Whether to allow limited HTML tags
            max_length: Maximum length override
            
        Returns:
            str: Sanitized text
        """
        if not isinstance(text, str):
            text = str(text)
        
        # Basic cleanup
        text = text.strip()
        
        # Check length limits
        max_len = max_length or cls.MAX_LENGTHS.get(field_type, 1000)
        if len(text) > max_len:
            text = text[:max_len]
        
        # HTML sanitization
        if allow_html:
            # Use bleach for HTML sanitization
            text = bleach.clean(
                text,
                tags=cls.ALLOWED_TAGS,
                attributes=cls.ALLOWED_ATTRIBUTES,
                protocols=cls.ALLOWED_PROTOCOLS,
                strip=True
            )
        else:
            # Escape HTML entities
            text = html.escape(text)
        
        # Field-specific sanitization
        if field_type == 'username':
            # Remove any characters not allowed in usernames
            text = re.sub(r'[^a-zA-Z0-9_.-]', '', text)
        elif field_type == 'email':
            # Basic email format validation
            text = text.lower().strip()
        elif field_type == 'url':
            # Ensure URL has proper scheme
            if text and not text.startswith(('http://', 'https://')):
                text = 'https://' + text
        elif field_type == 'post_content':
            # Preserve line breaks but sanitize content
            text = cls._sanitize_post_content(text)
        
        return text
    
    @classmethod
    def _sanitize_post_content(cls, content: str) -> str:
        """
        Sanitize post content while preserving mentions and formatting.
        
        Args:
            content: Post content to sanitize
            
        Returns:
            str: Sanitized content
        """
        # Escape HTML but preserve line breaks
        content = html.escape(content)
        
        # Normalize line breaks
        content = re.sub(r'\r\n|\r', '\n', content)
        
        # Limit consecutive line breaks
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # Remove excessive whitespace
        content = re.sub(r'[ \t]{2,}', ' ', content)
        
        return content.strip()
    
    @classmethod
    def sanitize_dict(
        cls, 
        data: Dict[str, Any], 
        field_mappings: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Sanitize dictionary data with field-specific rules.
        
        Args:
            data: Dictionary to sanitize
            field_mappings: Mapping of field names to field types
            
        Returns:
            Dict: Sanitized dictionary
        """
        if not isinstance(data, dict):
            return data
        
        field_mappings = field_mappings or {}
        sanitized = {}
        
        for key, value in data.items():
            if isinstance(value, str):
                field_type = field_mappings.get(key, 'general')
                sanitized[key] = cls.sanitize_text(value, field_type)
            elif isinstance(value, dict):
                sanitized[key] = cls.sanitize_dict(value, field_mappings)
            elif isinstance(value, list):
                sanitized[key] = [
                    cls.sanitize_text(item, field_mappings.get(key, 'general'))
                    if isinstance(item, str) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        
        return sanitized
    
    @classmethod
    def validate_file_upload(
        cls,
        filename: str,
        content_type: str,
        file_size: int,
        allowed_types: Optional[List[str]] = None,
        max_size: int = 10 * 1024 * 1024  # 10MB default
    ) -> Dict[str, Any]:
        """
        Validate file upload parameters.
        
        Args:
            filename: Original filename
            content_type: MIME type
            file_size: File size in bytes
            allowed_types: List of allowed MIME types
            max_size: Maximum file size in bytes
            
        Returns:
            Dict: Validation result
        """
        errors = []
        
        # Default allowed types for images
        if allowed_types is None:
            allowed_types = [
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/gif'
            ]
        
        # Sanitize filename
        safe_filename = cls._sanitize_filename(filename)
        
        # Check file size
        if file_size > max_size:
            errors.append(f"File size ({file_size} bytes) exceeds maximum ({max_size} bytes)")
        
        # Check content type
        if content_type not in allowed_types:
            errors.append(f"File type '{content_type}' not allowed. Allowed types: {allowed_types}")
        
        # Check file extension matches content type
        extension = safe_filename.split('.')[-1].lower() if '.' in safe_filename else ''
        expected_extensions = {
            'image/jpeg': ['jpg', 'jpeg'],
            'image/png': ['png'],
            'image/webp': ['webp'],
            'image/gif': ['gif']
        }
        
        if content_type in expected_extensions:
            if extension not in expected_extensions[content_type]:
                errors.append(f"File extension '{extension}' doesn't match content type '{content_type}'")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'safe_filename': safe_filename,
            'sanitized_content_type': content_type
        }
    
    @classmethod
    def _sanitize_filename(cls, filename: str) -> str:
        """
        Sanitize filename for safe storage.
        
        Args:
            filename: Original filename
            
        Returns:
            str: Sanitized filename
        """
        # Remove path components
        filename = filename.split('/')[-1].split('\\')[-1]
        
        # Remove dangerous characters
        filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        
        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:250] + ('.' + ext if ext else '')
        
        # Ensure it's not empty
        if not filename or filename.startswith('.'):
            filename = 'upload_' + filename
        
        return filename


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically sanitize user input.
    """
    
    # Field type mappings for different endpoints
    FIELD_MAPPINGS = {
        '/api/v1/auth/register': {
            'username': 'username',
            'email': 'email',
            'password': 'password'
        },
        '/api/v1/auth/login': {
            'username': 'username',
            'email': 'email',
            'password': 'password'
        },
        '/api/v1/users/me/profile': {
            'username': 'username',
            'email': 'email',
            'bio': 'bio',
            'display_name': 'display_name',
            'city': 'city',
            'institutions': 'institution',
            'websites': 'url'
        },
        '/api/v1/posts': {
            'content': 'post_content',
            'post_type': 'general',
            'location': 'city'
        },
        '/api/v1/users/search': {
            'q': 'search_query',
            'query': 'search_query'
        }
    }
    
    # Endpoints that should skip sanitization (e.g., file uploads handled separately)
    SKIP_ENDPOINTS = {
        '/api/v1/users/me/profile/photo',
        '/uploads/',
        '/health',
        '/docs',
        '/openapi.json'
    }
    
    def __init__(self, app):
        super().__init__(app)
        self.sanitizer = InputSanitizer()
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Sanitize request data before processing."""
        # TEMPORARILY DISABLED: Input sanitization middleware is causing request body consumption issues
        # This needs to be reimplemented to avoid interfering with FastAPI's request body handling
        # For now, we'll rely on Pydantic validation and manual sanitization in endpoints
        
        logger.debug(
            f"Input sanitization middleware bypassed for {request.method} {request.url.path}",
            extra={
                "request_id": getattr(request.state, 'request_id', None),
                "endpoint": request.url.path,
                "method": request.method,
                "note": "Middleware temporarily disabled to prevent request body consumption issues"
            }
        )
        
        return await call_next(request)
    
    def _get_field_mappings(self, path: str) -> Dict[str, str]:
        """Get field mappings for endpoint path."""
        # Exact match first
        if path in self.FIELD_MAPPINGS:
            return self.FIELD_MAPPINGS[path]
        
        # Pattern matching for parameterized endpoints
        for pattern, mappings in self.FIELD_MAPPINGS.items():
            if self._path_matches_pattern(path, pattern):
                return mappings
        
        return {}
    
    def _path_matches_pattern(self, path: str, pattern: str) -> bool:
        """Check if path matches pattern with wildcards."""
        # Simple pattern matching - replace * with regex
        regex_pattern = pattern.replace('*', '[^/]+')
        return re.match(f"^{regex_pattern}$", path) is not None
    
    async def _sanitize_request_body(self, request: Request, field_mappings: Dict[str, str]):
        """Sanitize request body data."""
        content_type = request.headers.get('content-type', '')
        
        if 'application/json' in content_type:
            await self._sanitize_json_body(request, field_mappings)
        elif 'application/x-www-form-urlencoded' in content_type:
            await self._sanitize_form_body(request, field_mappings)
        elif 'multipart/form-data' in content_type:
            # Handle multipart data (forms with files)
            await self._sanitize_multipart_body(request, field_mappings)
    
    async def _sanitize_json_body(self, request: Request, field_mappings: Dict[str, str]):
        """Sanitize JSON request body."""
        try:
            # Read the body without consuming it
            body = await request.body()
            if not body:
                return
            
            data = json.loads(body)
            sanitized_data = self.sanitizer.sanitize_dict(data, field_mappings)
            
            # Store sanitized data in request state instead of modifying body
            # This avoids the issue of consuming the request body stream
            request.state.sanitized_json_data = sanitized_data
            
            # Create a new body stream with sanitized data
            from io import BytesIO
            sanitized_body = json.dumps(sanitized_data).encode('utf-8')
            
            # Replace the receive callable to provide the sanitized body
            original_receive = request.receive
            
            async def receive():
                return {
                    "type": "http.request",
                    "body": sanitized_body,
                    "more_body": False
                }
            
            request._receive = receive
            
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.warning(f"Failed to parse JSON body for sanitization: {e}")
    
    async def _sanitize_form_body(self, request: Request, field_mappings: Dict[str, str]):
        """Sanitize form-encoded request body."""
        try:
            form_data = await request.form()
            sanitized_data = {}
            
            for key, value in form_data.items():
                if isinstance(value, str):
                    field_type = field_mappings.get(key, 'general')
                    sanitized_data[key] = self.sanitizer.sanitize_text(value, field_type)
                else:
                    sanitized_data[key] = value
            
            # Note: Replacing form data is more complex, so we'll store sanitized data
            # in request state for the endpoint to use
            request.state.sanitized_form_data = sanitized_data
            
        except Exception as e:
            logger.warning(f"Failed to sanitize form data: {e}")
    
    async def _sanitize_multipart_body(self, request: Request, field_mappings: Dict[str, str]):
        """Sanitize multipart form data."""
        try:
            form_data = await request.form()
            sanitized_data = {}
            
            for key, value in form_data.items():
                if hasattr(value, 'filename'):
                    # File upload - validate but don't modify
                    validation = self.sanitizer.validate_file_upload(
                        filename=value.filename,
                        content_type=value.content_type,
                        file_size=len(await value.read())
                    )
                    # Reset file pointer
                    await value.seek(0)
                    
                    if not validation['valid']:
                        logger.warning(
                            f"File upload validation failed: {validation['errors']}",
                            extra={"filename": value.filename}
                        )
                    
                    sanitized_data[key] = value
                elif isinstance(value, str):
                    field_type = field_mappings.get(key, 'general')
                    sanitized_data[key] = self.sanitizer.sanitize_text(value, field_type)
                else:
                    sanitized_data[key] = value
            
            request.state.sanitized_form_data = sanitized_data
            
        except Exception as e:
            logger.warning(f"Failed to sanitize multipart data: {e}")


def sanitize_user_input(
    data: Union[str, Dict[str, Any]], 
    field_type: str = 'general',
    field_mappings: Optional[Dict[str, str]] = None
) -> Union[str, Dict[str, Any]]:
    """
    Utility function to sanitize user input.
    
    Args:
        data: Data to sanitize (string or dictionary)
        field_type: Type of field for string data
        field_mappings: Field mappings for dictionary data
        
    Returns:
        Sanitized data
    """
    sanitizer = InputSanitizer()
    
    if isinstance(data, str):
        return sanitizer.sanitize_text(data, field_type)
    elif isinstance(data, dict):
        return sanitizer.sanitize_dict(data, field_mappings or {})
    else:
        return data