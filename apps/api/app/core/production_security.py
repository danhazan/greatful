"""
Production-grade security configuration and monitoring system.

This module provides comprehensive security features for production deployment:
- Advanced security headers
- JWT token security validation
- Production CORS policies
- Security monitoring and alerting
- Automated security configuration validation
"""

import os
import jwt
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from fastapi import Request, HTTPException
from dataclasses import dataclass
from app.core.security_config import security_config
from app.core.security_audit import SecurityAuditor, SecurityEventType

logger = logging.getLogger(__name__)


@dataclass
class SecurityValidationResult:
    """Result of security configuration validation."""
    is_valid: bool
    issues: List[str]
    warnings: List[str]
    recommendations: List[str]


class ProductionSecurityManager:
    """
    Comprehensive production security management system.
    """
    
    # Critical security thresholds
    MIN_SECRET_KEY_LENGTH = 32
    MAX_ACCESS_TOKEN_HOURS = 24
    MAX_REFRESH_TOKEN_DAYS = 90
    
    # Secure JWT configuration
    SECURE_JWT_ALGORITHMS = ["HS256", "HS384", "HS512"]
    
    # Production-safe CORS origins patterns
    SAFE_CORS_PATTERNS = [
        r"^https://[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$",  # HTTPS domains only
        r"^https://localhost:\d+$",  # HTTPS localhost for development
        r"^http://localhost:\d+$",   # HTTP localhost for development only
    ]
    
    @classmethod
    def validate_production_security(cls) -> SecurityValidationResult:
        """
        Comprehensive validation of production security configuration.
        
        Returns:
            SecurityValidationResult: Validation results with issues and recommendations
        """
        issues = []
        warnings = []
        recommendations = []
        
        # Validate JWT configuration
        jwt_issues, jwt_warnings, jwt_recommendations = cls._validate_jwt_config()
        issues.extend(jwt_issues)
        warnings.extend(jwt_warnings)
        recommendations.extend(jwt_recommendations)
        
        # Validate CORS configuration
        cors_issues, cors_warnings, cors_recommendations = cls._validate_cors_config()
        issues.extend(cors_issues)
        warnings.extend(cors_warnings)
        recommendations.extend(cors_recommendations)
        
        # Validate environment variables
        env_issues, env_warnings, env_recommendations = cls._validate_environment_config()
        issues.extend(env_issues)
        warnings.extend(env_warnings)
        recommendations.extend(env_recommendations)
        
        # Validate security headers
        header_issues, header_warnings, header_recommendations = cls._validate_security_headers()
        issues.extend(header_issues)
        warnings.extend(header_warnings)
        recommendations.extend(header_recommendations)
        
        is_valid = len(issues) == 0
        
        return SecurityValidationResult(
            is_valid=is_valid,
            issues=issues,
            warnings=warnings,
            recommendations=recommendations
        )
    
    @classmethod
    def _validate_jwt_config(cls) -> Tuple[List[str], List[str], List[str]]:
        """Validate JWT token configuration."""
        issues = []
        warnings = []
        recommendations = []
        
        # Check secret key
        secret_key = security_config.secret_key
        if secret_key == "your-super-secret-key-change-this-in-production":
            issues.append("SECRET_KEY must be changed from default value in production")
        
        if len(secret_key) < cls.MIN_SECRET_KEY_LENGTH:
            issues.append(f"SECRET_KEY must be at least {cls.MIN_SECRET_KEY_LENGTH} characters long")
        
        # Check for weak secret keys
        if secret_key.lower() in ["secret", "password", "key", "token"]:
            issues.append("SECRET_KEY appears to be a weak/common value")
        
        # Check token expiration times
        if security_config.access_token_expire_minutes > (cls.MAX_ACCESS_TOKEN_HOURS * 60):
            warnings.append(f"ACCESS_TOKEN_EXPIRE_MINUTES should not exceed {cls.MAX_ACCESS_TOKEN_HOURS} hours")
        
        if security_config.refresh_token_expire_days > cls.MAX_REFRESH_TOKEN_DAYS:
            warnings.append(f"REFRESH_TOKEN_EXPIRE_DAYS should not exceed {cls.MAX_REFRESH_TOKEN_DAYS} days")
        
        # Recommendations
        if security_config.access_token_expire_minutes > 60:
            recommendations.append("Consider shorter access token expiration (≤60 minutes) for better security")
        
        if len(secret_key) < 64:
            recommendations.append("Consider using a 64+ character secret key for enhanced security")
        
        return issues, warnings, recommendations
    
    @classmethod
    def _validate_cors_config(cls) -> Tuple[List[str], List[str], List[str]]:
        """Validate CORS configuration."""
        issues = []
        warnings = []
        recommendations = []
        
        allowed_origins = security_config.allowed_origins
        
        if not allowed_origins:
            issues.append("ALLOWED_ORIGINS must be configured")
            return issues, warnings, recommendations
        
        # Check for wildcard origins in production
        if security_config.is_production:
            if "*" in allowed_origins:
                issues.append("Wildcard CORS origins (*) are not allowed in production")
            
            # Check for HTTP origins in production
            for origin in allowed_origins:
                if origin.startswith("http://") and "localhost" not in origin:
                    issues.append(f"HTTP origin not allowed in production: {origin}")
        
        # Check for overly permissive origins
        suspicious_origins = ["null", "file://", "data:", "javascript:"]
        for origin in allowed_origins:
            if any(suspicious in origin.lower() for suspicious in suspicious_origins):
                issues.append(f"Suspicious CORS origin detected: {origin}")
        
        # Recommendations
        if len(allowed_origins) > 10:
            recommendations.append("Consider reducing the number of allowed CORS origins")
        
        return issues, warnings, recommendations
    
    @classmethod
    def _validate_environment_config(cls) -> Tuple[List[str], List[str], List[str]]:
        """Validate environment configuration."""
        issues = []
        warnings = []
        recommendations = []
        
        # Check required environment variables
        required_vars = ["SECRET_KEY", "DATABASE_URL"]
        for var in required_vars:
            if not os.getenv(var):
                issues.append(f"Required environment variable {var} is not set")
        
        # Check production-specific variables
        if security_config.is_production:
            prod_vars = ["ALLOWED_ORIGINS", "FRONTEND_BASE_URL"]
            for var in prod_vars:
                if not os.getenv(var):
                    warnings.append(f"Production environment variable {var} is not set")
        
        # Check for development values in production
        if security_config.is_production:
            dev_indicators = ["localhost", "127.0.0.1", "test", "dev", "debug"]
            database_url = os.getenv("DATABASE_URL", "")
            
            for indicator in dev_indicators:
                if indicator in database_url.lower():
                    warnings.append(f"Database URL contains development indicator: {indicator}")
        
        # Check SSL configuration
        if security_config.is_production and not security_config.ssl_redirect:
            warnings.append("SSL_REDIRECT should be enabled in production")
        
        return issues, warnings, recommendations
    
    @classmethod
    def _validate_security_headers(cls) -> Tuple[List[str], List[str], List[str]]:
        """Validate security headers configuration."""
        issues = []
        warnings = []
        recommendations = []
        
        headers = security_config.get_security_headers()
        
        # Check for required security headers
        required_headers = [
            "Content-Security-Policy",
            "X-Frame-Options",
            "X-Content-Type-Options",
            "Strict-Transport-Security"
        ]
        
        for header in required_headers:
            if header not in headers:
                if header == "Strict-Transport-Security" and not security_config.is_production:
                    continue  # HSTS only required in production
                issues.append(f"Required security header missing: {header}")
        
        # Validate CSP
        csp = headers.get("Content-Security-Policy", "")
        if "unsafe-eval" in csp:
            warnings.append("CSP contains 'unsafe-eval' - consider removing if possible")
        
        if "unsafe-inline" in csp:
            warnings.append("CSP contains 'unsafe-inline' - consider using nonces or hashes")
        
        # Check HSTS configuration
        if security_config.is_production:
            hsts = headers.get("Strict-Transport-Security", "")
            if "preload" not in hsts:
                recommendations.append("Consider adding 'preload' to HSTS header")
            
            if "includeSubDomains" not in hsts:
                recommendations.append("Consider adding 'includeSubDomains' to HSTS header")
        
        return issues, warnings, recommendations
    
    @classmethod
    def generate_secure_secret_key(cls, length: int = 64) -> str:
        """
        Generate a cryptographically secure secret key.
        
        Args:
            length: Length of the secret key (default: 64)
            
        Returns:
            str: Secure random secret key
        """
        return secrets.token_urlsafe(length)
    
    @classmethod
    def validate_jwt_token_security(cls, token: str) -> Dict[str, Any]:
        """
        Validate JWT token security properties.
        
        Args:
            token: JWT token to validate
            
        Returns:
            Dict with validation results
        """
        try:
            # Decode without verification to check structure
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
            
            issues = []
            warnings = []
            
            # Check for required claims
            required_claims = ["sub", "exp", "iat", "jti"]
            for claim in required_claims:
                if claim not in unverified_payload:
                    issues.append(f"Missing required JWT claim: {claim}")
            
            # Check expiration
            if "exp" in unverified_payload:
                exp_timestamp = unverified_payload["exp"]
                exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
                now = datetime.now(timezone.utc)
                
                if exp_datetime < now:
                    issues.append("Token has expired")
                
                # Check if expiration is too far in the future
                max_future = now + timedelta(days=cls.MAX_REFRESH_TOKEN_DAYS)
                if exp_datetime > max_future:
                    warnings.append("Token expiration is unusually far in the future")
            
            # Check issued at time
            if "iat" in unverified_payload:
                iat_timestamp = unverified_payload["iat"]
                iat_datetime = datetime.fromtimestamp(iat_timestamp, tz=timezone.utc)
                now = datetime.now(timezone.utc)
                
                # Check if token was issued in the future
                if iat_datetime > now + timedelta(minutes=5):  # 5 minute clock skew tolerance
                    issues.append("Token issued in the future")
            
            # Check JWT ID uniqueness (basic check)
            if "jti" in unverified_payload:
                jti = unverified_payload["jti"]
                if len(jti) < 16:
                    warnings.append("JWT ID (jti) appears to be too short for uniqueness")
            
            return {
                "valid": len(issues) == 0,
                "issues": issues,
                "warnings": warnings,
                "payload": unverified_payload
            }
            
        except jwt.DecodeError:
            return {
                "valid": False,
                "issues": ["Invalid JWT token format"],
                "warnings": [],
                "payload": None
            }
    
    @classmethod
    def log_security_configuration_check(cls, request: Request):
        """Log security configuration validation results."""
        validation_result = cls.validate_production_security()
        
        if not validation_result.is_valid:
            SecurityAuditor.log_security_event(
                event_type=SecurityEventType.CONFIGURATION_CHANGE,
                request=request,
                details={
                    "validation_result": "failed",
                    "issues": validation_result.issues,
                    "warnings": validation_result.warnings
                },
                severity="ERROR",
                success=False
            )
        elif validation_result.warnings:
            SecurityAuditor.log_security_event(
                event_type=SecurityEventType.CONFIGURATION_CHANGE,
                request=request,
                details={
                    "validation_result": "warnings",
                    "warnings": validation_result.warnings,
                    "recommendations": validation_result.recommendations
                },
                severity="WARNING",
                success=True
            )
        else:
            SecurityAuditor.log_security_event(
                event_type=SecurityEventType.CONFIGURATION_CHANGE,
                request=request,
                details={
                    "validation_result": "passed",
                    "recommendations": validation_result.recommendations
                },
                severity="INFO",
                success=True
            )
    
    @classmethod
    def get_security_monitoring_config(cls) -> Dict[str, Any]:
        """Get security monitoring configuration."""
        return {
            "jwt_validation": {
                "min_secret_key_length": cls.MIN_SECRET_KEY_LENGTH,
                "max_access_token_hours": cls.MAX_ACCESS_TOKEN_HOURS,
                "max_refresh_token_days": cls.MAX_REFRESH_TOKEN_DAYS,
                "allowed_algorithms": cls.SECURE_JWT_ALGORITHMS
            },
            "cors_validation": {
                "safe_patterns": cls.SAFE_CORS_PATTERNS,
                "production_requires_https": True
            },
            "security_headers": {
                "required_headers": [
                    "Content-Security-Policy",
                    "X-Frame-Options", 
                    "X-Content-Type-Options",
                    "Strict-Transport-Security"
                ],
                "recommended_headers": [
                    "Cross-Origin-Embedder-Policy",
                    "Cross-Origin-Opener-Policy",
                    "Permissions-Policy"
                ]
            },
            "monitoring": {
                "validate_on_startup": True,
                "log_security_events": True,
                "alert_on_issues": True
            }
        }


class SecurityConfigurationValidator:
    """
    Automated security configuration validation and monitoring.
    """
    
    @classmethod
    def validate_on_startup(cls) -> bool:
        """
        Validate security configuration on application startup.
        
        Returns:
            bool: True if configuration is valid, False otherwise
        """
        logger.info("Validating production security configuration...")
        
        validation_result = ProductionSecurityManager.validate_production_security()
        
        if validation_result.issues:
            logger.error("Security configuration validation failed:")
            for issue in validation_result.issues:
                logger.error(f"  ISSUE: {issue}")
        
        if validation_result.warnings:
            logger.warning("Security configuration warnings:")
            for warning in validation_result.warnings:
                logger.warning(f"  WARNING: {warning}")
        
        if validation_result.recommendations:
            logger.info("Security configuration recommendations:")
            for recommendation in validation_result.recommendations:
                logger.info(f"  RECOMMENDATION: {recommendation}")
        
        if not validation_result.is_valid:
            logger.error("Security configuration validation FAILED - application may not be secure")
            if security_config.is_production:
                logger.critical("CRITICAL: Production deployment with invalid security configuration")
                # In production, we might want to prevent startup with critical issues
                critical_keywords = ["SECRET_KEY", "default value", "wildcard"]
                has_critical_issues = any(
                    any(keyword in issue for keyword in critical_keywords)
                    for issue in validation_result.issues
                )
                if has_critical_issues:
                    raise ValueError("Critical security configuration issues prevent production startup")
        else:
            logger.info("Security configuration validation PASSED")
        
        return validation_result.is_valid
    
    @classmethod
    def get_security_status_report(cls) -> Dict[str, Any]:
        """
        Get comprehensive security status report.
        
        Returns:
            Dict with security status information
        """
        validation_result = ProductionSecurityManager.validate_production_security()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "environment": security_config.environment,
            "security_status": "SECURE" if validation_result.is_valid else "ISSUES_DETECTED",
            "validation_result": {
                "is_valid": validation_result.is_valid,
                "issues_count": len(validation_result.issues),
                "warnings_count": len(validation_result.warnings),
                "recommendations_count": len(validation_result.recommendations)
            },
            "configuration": {
                "jwt_config": {
                    "access_token_expire_minutes": security_config.access_token_expire_minutes,
                    "refresh_token_expire_days": security_config.refresh_token_expire_days,
                    "secret_key_length": len(security_config.secret_key)
                },
                "cors_config": {
                    "allowed_origins_count": len(security_config.allowed_origins),
                    "has_https_origins": any(origin.startswith("https://") for origin in security_config.allowed_origins)
                },
                "security_features": {
                    "ssl_redirect": security_config.ssl_redirect,
                    "hsts_max_age": security_config.hsts_max_age,
                    "rate_limiting_enabled": True,
                    "input_sanitization_enabled": True,
                    "security_headers_enabled": True
                }
            },
            "issues": validation_result.issues,
            "warnings": validation_result.warnings,
            "recommendations": validation_result.recommendations
        }


# Initialize security validation on module import
def initialize_production_security():
    """Initialize production security configuration and validation."""
    try:
        # Only validate on startup if not in test environment
        if not os.getenv('TESTING') and not os.getenv('PYTEST_CURRENT_TEST'):
            SecurityConfigurationValidator.validate_on_startup()
    except Exception as e:
        logger.error(f"Failed to initialize production security: {e}")
        if security_config.is_production:
            raise


# Auto-initialize when module is imported
initialize_production_security()