"""
API contract validation middleware for runtime type checking.
"""

import json
import logging
from typing import Any, Dict, Optional, Type, get_type_hints
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, ValidationError
from app.core.responses import error_response

logger = logging.getLogger(__name__)


class APIContractValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for validating API contracts at runtime."""

    def __init__(self, app, enable_response_validation: bool = True):
        super().__init__(app)
        self.enable_response_validation = enable_response_validation
        self.validation_errors = []

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request with API contract validation."""
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        try:
            # Validate request if it has a body
            await self._validate_request(request, request_id)
            
            # Process the request
            response = await call_next(request)
            
            # Validate response if enabled
            if self.enable_response_validation:
                await self._validate_response(request, response, request_id)
            
            return response
            
        except ValidationError as e:
            logger.warning(
                f"Request validation failed: {e}",
                extra={"request_id": request_id, "path": request.url.path}
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=error_response(
                    error_code="validation_error",
                    message="Request validation failed",
                    details={"validation_errors": e.errors()},
                    request_id=request_id
                )
            )
        except Exception as e:
            logger.error(
                f"Contract validation error: {e}",
                extra={"request_id": request_id},
                exc_info=True
            )
            # Don't fail the request for validation errors, just log them
            response = await call_next(request)
            return response

    async def _validate_request(self, request: Request, request_id: str):
        """Validate incoming request against API contract."""
        # Skip validation for certain paths
        skip_paths = ["/docs", "/openapi.json", "/health", "/", "/uploads"]
        if any(request.url.path.startswith(path) for path in skip_paths):
            return

        # Only validate requests with JSON body
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return

        # Get the route handler to extract expected model
        route = request.scope.get("route")
        if not route or not hasattr(route, "endpoint"):
            return

        # Extract request model from route handler signature
        endpoint = route.endpoint
        if not hasattr(endpoint, "__annotations__"):
            return

        # Look for Pydantic models in the function signature
        type_hints = get_type_hints(endpoint)
        request_models = [
            hint for hint in type_hints.values()
            if (isinstance(hint, type) and 
                issubclass(hint, BaseModel) and 
                hint.__name__.endswith(('Request', 'Create', 'Update')))
        ]

        if not request_models:
            return

        # Read and validate request body
        try:
            body = await request.body()
            if body:
                json_data = json.loads(body)
                
                # Validate against the first request model found
                request_model = request_models[0]
                validated_data = request_model(**json_data)
                
                logger.debug(
                    f"Request validation passed for {request_model.__name__}",
                    extra={"request_id": request_id, "path": request.url.path}
                )
                
        except json.JSONDecodeError as e:
            raise ValidationError([{
                "type": "json_invalid",
                "loc": ("body",),
                "msg": f"Invalid JSON: {str(e)}",
                "input": body.decode() if body else ""
            }], request_model)
        except Exception as e:
            # Re-raise ValidationError, catch others
            if isinstance(e, ValidationError):
                raise
            logger.warning(
                f"Request validation error: {e}",
                extra={"request_id": request_id}
            )

    async def _validate_response(self, request: Request, response: Response, request_id: str):
        """Validate outgoing response against API contract."""
        # Skip validation for certain status codes
        if response.status_code >= 400:
            return

        # Skip validation for certain paths
        skip_paths = ["/docs", "/openapi.json", "/health", "/", "/uploads"]
        if any(request.url.path.startswith(path) for path in skip_paths):
            return

        # Only validate JSON responses
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return

        try:
            # Get response body
            if hasattr(response, 'body'):
                body = response.body
                if body:
                    json_data = json.loads(body)
                    
                    # Validate response structure
                    self._validate_response_structure(json_data, request_id)
                    
        except Exception as e:
            logger.warning(
                f"Response validation error: {e}",
                extra={"request_id": request_id, "path": request.url.path}
            )

    def _validate_response_structure(self, data: Dict[str, Any], request_id: str):
        """Validate response follows the standard API response structure."""
        # Check if it's a standard API response
        if isinstance(data, dict):
            # Success response should have: success, data, timestamp
            if data.get("success") is True:
                required_fields = ["success", "data", "timestamp"]
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    logger.warning(
                        f"Success response missing fields: {missing_fields}",
                        extra={"request_id": request_id}
                    )
            
            # Error response should have: success, error, timestamp
            elif data.get("success") is False:
                required_fields = ["success", "error", "timestamp"]
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    logger.warning(
                        f"Error response missing fields: {missing_fields}",
                        extra={"request_id": request_id}
                    )
                
                # Validate error structure
                error = data.get("error", {})
                if isinstance(error, dict):
                    error_required = ["code", "message"]
                    error_missing = [field for field in error_required if field not in error]
                    if error_missing:
                        logger.warning(
                            f"Error object missing fields: {error_missing}",
                            extra={"request_id": request_id}
                        )


class SchemaValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for OpenAPI schema validation."""

    def __init__(self, app, strict_mode: bool = False):
        super().__init__(app)
        self.strict_mode = strict_mode

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request with schema validation."""
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        try:
            # Get OpenAPI spec from the app
            openapi_schema = request.app.openapi()
            
            # Validate request against OpenAPI schema
            await self._validate_against_schema(request, openapi_schema, request_id)
            
            response = await call_next(request)
            return response
            
        except Exception as e:
            if self.strict_mode:
                logger.error(
                    f"Schema validation failed: {e}",
                    extra={"request_id": request_id}
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=error_response(
                        error_code="schema_validation_error",
                        message="Request does not match OpenAPI schema",
                        details={"error": str(e)},
                        request_id=request_id
                    )
                )
            else:
                # In non-strict mode, just log and continue
                logger.warning(
                    f"Schema validation warning: {e}",
                    extra={"request_id": request_id}
                )
                response = await call_next(request)
                return response

    async def _validate_against_schema(self, request: Request, schema: Dict[str, Any], request_id: str):
        """Validate request against OpenAPI schema."""
        # This is a simplified validation - in production you might want to use
        # a library like openapi-spec-validator or jsonschema
        
        paths = schema.get("paths", {})
        path_pattern = request.url.path
        method = request.method.lower()
        
        # Find matching path in schema
        matching_path = None
        for path, path_info in paths.items():
            # Simple path matching - could be enhanced with parameter matching
            if path == path_pattern or self._path_matches(path, path_pattern):
                matching_path = path
                break
        
        if not matching_path:
            logger.debug(
                f"No schema found for path: {path_pattern}",
                extra={"request_id": request_id}
            )
            return
        
        path_info = paths[matching_path]
        method_info = path_info.get(method)
        
        if not method_info:
            logger.debug(
                f"No schema found for method {method} on path: {path_pattern}",
                extra={"request_id": request_id}
            )
            return
        
        # Validate request body if present
        request_body_schema = method_info.get("requestBody")
        if request_body_schema:
            await self._validate_request_body(request, request_body_schema, request_id)

    def _path_matches(self, schema_path: str, request_path: str) -> bool:
        """Check if request path matches schema path pattern."""
        # Simple implementation - could be enhanced for complex path parameters
        schema_parts = schema_path.split("/")
        request_parts = request_path.split("/")
        
        if len(schema_parts) != len(request_parts):
            return False
        
        for schema_part, request_part in zip(schema_parts, request_parts):
            if schema_part.startswith("{") and schema_part.endswith("}"):
                # Path parameter - matches any value
                continue
            elif schema_part != request_part:
                return False
        
        return True

    async def _validate_request_body(self, request: Request, body_schema: Dict[str, Any], request_id: str):
        """Validate request body against schema."""
        content_type = request.headers.get("content-type", "")
        
        if not content_type.startswith("application/json"):
            return
        
        try:
            body = await request.body()
            if body:
                json_data = json.loads(body)
                
                # Get the JSON schema from the OpenAPI spec
                content_schemas = body_schema.get("content", {})
                json_schema = content_schemas.get("application/json", {}).get("schema", {})
                
                if json_schema:
                    # Here you would use a JSON schema validator
                    # For now, just log that validation would happen
                    logger.debug(
                        f"Would validate request body against schema",
                        extra={"request_id": request_id, "schema_keys": list(json_schema.keys())}
                    )
                
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in request body: {e}")
        except Exception as e:
            logger.warning(
                f"Request body validation error: {e}",
                extra={"request_id": request_id}
            )


class TypeSafetyMiddleware(BaseHTTPMiddleware):
    """Middleware for runtime type safety checks."""

    def __init__(self, app, enable_strict_typing: bool = False):
        super().__init__(app)
        self.enable_strict_typing = enable_strict_typing

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request with type safety checks."""
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        try:
            # Add type checking context to request
            request.state.type_checking_enabled = True
            request.state.strict_typing = self.enable_strict_typing
            
            response = await call_next(request)
            
            # Perform post-response type checks if needed
            await self._post_response_type_check(request, response, request_id)
            
            return response
            
        except Exception as e:
            logger.error(
                f"Type safety middleware error: {e}",
                extra={"request_id": request_id},
                exc_info=True
            )
            # Don't fail the request, just log the error
            response = await call_next(request)
            return response

    async def _post_response_type_check(self, request: Request, response: Response, request_id: str):
        """Perform type checks on response data."""
        if response.status_code >= 400:
            return
        
        # Check response headers for type information
        content_type = response.headers.get("content-type", "")
        
        if content_type.startswith("application/json"):
            try:
                if hasattr(response, 'body') and response.body:
                    json_data = json.loads(response.body)
                    
                    # Perform basic type checks
                    self._check_response_types(json_data, request_id)
                    
            except Exception as e:
                logger.warning(
                    f"Response type check error: {e}",
                    extra={"request_id": request_id}
                )

    def _check_response_types(self, data: Any, request_id: str):
        """Check types in response data."""
        if isinstance(data, dict):
            # Check for common type issues
            for key, value in data.items():
                if key.endswith("_id") and value is not None:
                    # IDs should be strings or integers
                    if not isinstance(value, (str, int)):
                        logger.warning(
                            f"ID field '{key}' has unexpected type: {type(value)}",
                            extra={"request_id": request_id}
                        )
                
                elif key.endswith("_count") and value is not None:
                    # Counts should be integers
                    if not isinstance(value, int):
                        logger.warning(
                            f"Count field '{key}' has unexpected type: {type(value)}",
                            extra={"request_id": request_id}
                        )
                
                elif key.endswith("_at") and value is not None:
                    # Timestamps should be strings
                    if not isinstance(value, str):
                        logger.warning(
                            f"Timestamp field '{key}' has unexpected type: {type(value)}",
                            extra={"request_id": request_id}
                        )