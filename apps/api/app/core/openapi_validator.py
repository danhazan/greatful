"""
OpenAPI schema generation and validation utilities.
"""

import json
import logging
from typing import Any, Dict, List, Optional, Type
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class OpenAPIValidator:
    """Service for OpenAPI schema generation and validation."""

    def __init__(self, app: FastAPI):
        self.app = app
        self._schema_cache = None

    def generate_enhanced_schema(self) -> Dict[str, Any]:
        """
        Generate enhanced OpenAPI schema with additional validation rules.
        
        Returns:
            Enhanced OpenAPI schema
        """
        if self._schema_cache is None:
            # Get base schema from FastAPI
            base_schema = get_openapi(
                title=self.app.title,
                version=self.app.version,
                description=self.app.description,
                routes=self.app.routes,
            )
            
            # Enhance schema with additional validation rules
            enhanced_schema = self._enhance_schema(base_schema)
            self._schema_cache = enhanced_schema
        
        return self._schema_cache

    def _enhance_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance OpenAPI schema with additional validation rules.
        
        Args:
            schema: Base OpenAPI schema
            
        Returns:
            Enhanced schema
        """
        enhanced = schema.copy()
        
        # Add custom validation rules to components
        if "components" not in enhanced:
            enhanced["components"] = {}
        
        if "schemas" not in enhanced["components"]:
            enhanced["components"]["schemas"] = {}
        
        # Add shared type definitions
        enhanced["components"]["schemas"].update(self._get_shared_type_schemas())
        
        # Enhance path definitions
        if "paths" in enhanced:
            for path, path_info in enhanced["paths"].items():
                for method, method_info in path_info.items():
                    if isinstance(method_info, dict):
                        self._enhance_path_method(method_info, path, method)
        
        # Add security schemes
        enhanced["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT"
            }
        }
        
        # Add global security requirement
        enhanced["security"] = [{"BearerAuth": []}]
        
        return enhanced

    def _get_shared_type_schemas(self) -> Dict[str, Any]:
        """
        Get schema definitions for shared types.
        
        Returns:
            Dictionary of schema definitions
        """
        schemas = {}
        
        # Add common response schemas
        schemas["ApiSuccessResponse"] = {
            "type": "object",
            "required": ["success", "data", "timestamp"],
            "properties": {
                "success": {"type": "boolean", "const": True},
                "data": {"type": "object"},
                "timestamp": {"type": "string", "format": "date-time"},
                "request_id": {"type": "string", "format": "uuid"}
            }
        }
        
        schemas["ApiErrorResponse"] = {
            "type": "object",
            "required": ["success", "error", "timestamp"],
            "properties": {
                "success": {"type": "boolean", "const": False},
                "error": {
                    "type": "object",
                    "required": ["code", "message"],
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "details": {"type": "object"}
                    }
                },
                "timestamp": {"type": "string", "format": "date-time"},
                "request_id": {"type": "string", "format": "uuid"}
            }
        }
        
        schemas["PaginatedResponse"] = {
            "type": "object",
            "required": ["success", "data", "pagination", "timestamp"],
            "properties": {
                "success": {"type": "boolean", "const": True},
                "data": {"type": "array", "items": {"type": "object"}},
                "pagination": {
                    "type": "object",
                    "required": ["total_count", "limit", "offset", "has_more"],
                    "properties": {
                        "total_count": {"type": "integer", "minimum": 0},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                        "offset": {"type": "integer", "minimum": 0},
                        "has_more": {"type": "boolean"}
                    }
                },
                "timestamp": {"type": "string", "format": "date-time"},
                "request_id": {"type": "string", "format": "uuid"}
            }
        }
        
        # Add enum schemas
        schemas["PostType"] = {
            "type": "string",
            "enum": ["daily", "photo", "spontaneous"],
            "description": "Type of gratitude post"
        }
        
        schemas["EmojiCode"] = {
            "type": "string",
            "enum": ["heart", "heart_eyes", "hug", "pray", "muscle", "grateful", "praise", "clap"],
            "description": "Valid emoji reaction codes"
        }
        
        schemas["NotificationType"] = {
            "type": "string",
            "enum": ["emoji_reaction", "post_shared", "mention", "new_follower", "share_milestone"],
            "description": "Type of notification"
        }
        
        # Add validation schemas
        schemas["ValidationError"] = {
            "type": "object",
            "required": ["field", "message", "code"],
            "properties": {
                "field": {"type": "string"},
                "message": {"type": "string"},
                "code": {"type": "string"},
                "value": {"type": "object"}
            }
        }
        
        return schemas

    def _enhance_path_method(self, method_info: Dict[str, Any], path: str, method: str):
        """
        Enhance individual path method with additional validation.
        
        Args:
            method_info: Method information from OpenAPI schema
            path: API path
            method: HTTP method
        """
        # Add standard error responses
        if "responses" not in method_info:
            method_info["responses"] = {}
        
        # Add common error responses
        method_info["responses"].update({
            "400": {
                "description": "Bad Request",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            },
            "401": {
                "description": "Unauthorized",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            },
            "403": {
                "description": "Forbidden",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            },
            "404": {
                "description": "Not Found",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            },
            "422": {
                "description": "Validation Error",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            },
            "429": {
                "description": "Rate Limit Exceeded",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            },
            "500": {
                "description": "Internal Server Error",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ApiErrorResponse"}
                    }
                }
            }
        })
        
        # Add security requirements for protected endpoints
        if not path.startswith("/health") and not path.startswith("/docs"):
            if "security" not in method_info:
                method_info["security"] = [{"BearerAuth": []}]

    def validate_schema_compliance(self, schema: Dict[str, Any]) -> List[str]:
        """
        Validate schema compliance with API standards.
        
        Args:
            schema: OpenAPI schema to validate
            
        Returns:
            List of compliance issues
        """
        issues = []
        
        # Check required top-level fields
        required_fields = ["openapi", "info", "paths"]
        for field in required_fields:
            if field not in schema:
                issues.append(f"Missing required field: {field}")
        
        # Check info section
        if "info" in schema:
            info = schema["info"]
            required_info_fields = ["title", "version"]
            for field in required_info_fields:
                if field not in info:
                    issues.append(f"Missing required info field: {field}")
        
        # Check paths
        if "paths" in schema:
            for path, path_info in schema["paths"].items():
                issues.extend(self._validate_path_compliance(path, path_info))
        
        # Check components
        if "components" in schema:
            issues.extend(self._validate_components_compliance(schema["components"]))
        
        return issues

    def _validate_path_compliance(self, path: str, path_info: Dict[str, Any]) -> List[str]:
        """
        Validate individual path compliance.
        
        Args:
            path: API path
            path_info: Path information
            
        Returns:
            List of compliance issues for this path
        """
        issues = []
        
        for method, method_info in path_info.items():
            if not isinstance(method_info, dict):
                continue
            
            method_prefix = f"{method.upper()} {path}"
            
            # Check required method fields
            if "responses" not in method_info:
                issues.append(f"{method_prefix}: Missing responses")
            
            # Check response structure
            if "responses" in method_info:
                responses = method_info["responses"]
                
                # Should have at least one success response
                success_responses = [code for code in responses.keys() if code.startswith("2")]
                if not success_responses:
                    issues.append(f"{method_prefix}: No success responses defined")
                
                # Check error response coverage
                if method != "get":
                    required_errors = ["400", "401", "422"]
                    for error_code in required_errors:
                        if error_code not in responses:
                            issues.append(f"{method_prefix}: Missing {error_code} error response")
        
        return issues

    def _validate_components_compliance(self, components: Dict[str, Any]) -> List[str]:
        """
        Validate components section compliance.
        
        Args:
            components: Components section
            
        Returns:
            List of compliance issues
        """
        issues = []
        
        # Check for required schemas
        if "schemas" in components:
            schemas = components["schemas"]
            required_schemas = ["ApiSuccessResponse", "ApiErrorResponse"]
            for schema_name in required_schemas:
                if schema_name not in schemas:
                    issues.append(f"Missing required schema: {schema_name}")
        
        # Check security schemes
        if "securitySchemes" not in components:
            issues.append("Missing security schemes")
        
        return issues

    def export_schema(self, file_path: str, format: str = "json"):
        """
        Export OpenAPI schema to file.
        
        Args:
            file_path: Path to export file
            format: Export format (json or yaml)
        """
        schema = self.generate_enhanced_schema()
        
        try:
            if format.lower() == "json":
                with open(file_path, "w") as f:
                    json.dump(schema, f, indent=2)
            elif format.lower() == "yaml":
                import yaml
                with open(file_path, "w") as f:
                    yaml.dump(schema, f, default_flow_style=False)
            else:
                raise ValueError(f"Unsupported format: {format}")
            
            logger.info(f"OpenAPI schema exported to {file_path}")
            
        except Exception as e:
            logger.error(f"Failed to export schema: {e}")
            raise

    def validate_request_against_schema(
        self, 
        path: str, 
        method: str, 
        data: Dict[str, Any]
    ) -> List[str]:
        """
        Validate request data against OpenAPI schema.
        
        Args:
            path: API path
            method: HTTP method
            data: Request data
            
        Returns:
            List of validation errors
        """
        schema = self.generate_enhanced_schema()
        errors = []
        
        # Find path in schema
        paths = schema.get("paths", {})
        path_info = paths.get(path)
        
        if not path_info:
            errors.append(f"Path not found in schema: {path}")
            return errors
        
        method_info = path_info.get(method.lower())
        if not method_info:
            errors.append(f"Method {method} not found for path: {path}")
            return errors
        
        # Validate request body if present
        request_body = method_info.get("requestBody")
        if request_body and data:
            # This would need a proper JSON schema validator
            # For now, just basic validation
            content = request_body.get("content", {})
            json_content = content.get("application/json", {})
            schema_def = json_content.get("schema", {})
            
            if schema_def:
                errors.extend(self._validate_data_against_schema(data, schema_def))
        
        return errors

    def _validate_data_against_schema(self, data: Any, schema_def: Dict[str, Any]) -> List[str]:
        """
        Validate data against JSON schema definition.
        
        Args:
            data: Data to validate
            schema_def: JSON schema definition
            
        Returns:
            List of validation errors
        """
        errors = []
        
        # Basic validation - in production you'd use jsonschema library
        schema_type = schema_def.get("type")
        
        if schema_type == "object" and not isinstance(data, dict):
            errors.append(f"Expected object, got {type(data).__name__}")
        elif schema_type == "array" and not isinstance(data, list):
            errors.append(f"Expected array, got {type(data).__name__}")
        elif schema_type == "string" and not isinstance(data, str):
            errors.append(f"Expected string, got {type(data).__name__}")
        elif schema_type == "integer" and not isinstance(data, int):
            errors.append(f"Expected integer, got {type(data).__name__}")
        elif schema_type == "boolean" and not isinstance(data, bool):
            errors.append(f"Expected boolean, got {type(data).__name__}")
        
        # Validate required fields for objects
        if schema_type == "object" and isinstance(data, dict):
            required = schema_def.get("required", [])
            for field in required:
                if field not in data:
                    errors.append(f"Missing required field: {field}")
        
        return errors


def create_openapi_validator(app: FastAPI) -> OpenAPIValidator:
    """Create OpenAPI validator instance."""
    return OpenAPIValidator(app)