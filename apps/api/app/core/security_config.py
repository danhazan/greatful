"""
Centralized security configuration for production deployment.
"""

import os
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class SecurityConfig:
    """Security configuration settings."""
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    
    # JWT Configuration
    secret_key: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
    
    # Rate Limiting
    default_rate_limit: int = int(os.getenv("DEFAULT_RATE_LIMIT", "100"))
    auth_rate_limit: int = int(os.getenv("AUTH_RATE_LIMIT", "10"))
    upload_rate_limit: int = int(os.getenv("UPLOAD_RATE_LIMIT", "20"))
    
    # Request Size Limits
    max_request_size: int = int(os.getenv("MAX_REQUEST_SIZE", str(10 * 1024 * 1024)))  # 10MB
    max_upload_size: int = int(os.getenv("MAX_UPLOAD_SIZE", str(10 * 1024 * 1024)))   # 10MB
    
    # CORS Configuration
    allowed_origins: List[str] = None
    
    # CSP Domains
    csp_domains: List[str] = None
    
    # SSL/TLS
    ssl_redirect: bool = os.getenv("SSL_REDIRECT", "false").lower() == "true"
    hsts_max_age: int = int(os.getenv("HSTS_MAX_AGE", "31536000"))  # 1 year
    
    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    security_log_level: str = os.getenv("SECURITY_LOG_LEVEL", "INFO")
    
    # Feature Flags
    enable_registration: bool = os.getenv("ENABLE_REGISTRATION", "true").lower() == "true"
    enable_file_uploads: bool = os.getenv("ENABLE_FILE_UPLOADS", "true").lower() == "true"
    enable_docs: bool = os.getenv("ENABLE_DOCS", "true").lower() == "true"
    
    def __post_init__(self):
        """Process configuration after initialization."""
        # Parse allowed origins
        origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
        self.allowed_origins = [origin.strip() for origin in origins_str.split(",") if origin.strip()]
        
        # Parse CSP domains
        csp_str = os.getenv("CSP_DOMAINS", "")
        self.csp_domains = [domain.strip() for domain in csp_str.split(",") if domain.strip()]
        
        # Validate security settings in production
        if self.environment == "production":
            self._validate_production_config()
    
    def _validate_production_config(self):
        """Validate security configuration for production."""
        issues = []
        
        # Check secret key
        if self.secret_key == "your-super-secret-key-change-this-in-production":
            issues.append("SECRET_KEY must be changed from default value in production")
        
        if len(self.secret_key) < 32:
            issues.append("SECRET_KEY should be at least 32 characters long")
        
        # Check HTTPS origins
        for origin in self.allowed_origins:
            if not origin.startswith("https://") and origin != "http://localhost:3000":
                issues.append(f"Production origin should use HTTPS: {origin}")
        
        # Check token expiration
        if self.access_token_expire_minutes > 1440:  # 24 hours
            issues.append("ACCESS_TOKEN_EXPIRE_MINUTES should not exceed 24 hours in production")
        
        if issues:
            import logging
            logger = logging.getLogger(__name__)
            logger.error("Production security configuration issues:")
            for issue in issues:
                logger.error(f"  - {issue}")
            
            if "SECRET_KEY" in str(issues):
                raise ValueError("Critical security configuration issues found. Please fix before deploying.")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"
    
    def get_cors_config(self) -> Dict[str, Any]:
        """Get CORS configuration."""
        return {
            "allow_origins": self.allowed_origins,
            "allow_credentials": True,
            "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": [
                "Accept",
                "Accept-Language",
                "Content-Language",
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "X-Request-ID"
            ],
            "expose_headers": ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
            "max_age": 86400,  # 24 hours
        }
    
    def get_security_headers(self) -> Dict[str, str]:
        """Get production-grade security headers configuration."""
        # Enhanced Content Security Policy for production
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Allow inline scripts for Next.js
            "style-src 'self' 'unsafe-inline'",  # Allow inline styles
            "img-src 'self' data: blob: https:",  # Allow images from various sources
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",  # Allow WebSocket connections
            "media-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests",  # Force HTTPS in production
        ]
        
        # Add CSP domains if specified
        if self.csp_domains:
            domains = " ".join(self.csp_domains)
            csp_directives[0] = f"default-src 'self' {domains}"
            csp_directives[5] = f"connect-src 'self' ws: wss: {domains}"
        
        # Production-grade security headers
        headers = {
            "Content-Security-Policy": "; ".join(csp_directives),
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
            # Allow cross-origin access to static files in development
            "Cross-Origin-Resource-Policy": "same-origin" if self.is_production else "cross-origin",
            "Permissions-Policy": ", ".join([
                "camera=()",
                "microphone=()",
                "geolocation=()",
                "payment=()",
                "usb=()",
                "magnetometer=()",
                "gyroscope=()",
                "accelerometer=()",
                "fullscreen=(self)",
                "display-capture=()",
                "web-share=(self)"
            ]),
            # Security headers for API responses
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Expires": "0",
            # Server information hiding
            "Server": "Grateful-API",
            "X-Powered-By": "",  # Remove server technology disclosure
        }
        
        # Add HSTS header for production with enhanced security
        if self.is_production:
            headers["Strict-Transport-Security"] = f"max-age={self.hsts_max_age}; includeSubDomains; preload"
        
        return headers
    
    def get_rate_limits(self) -> Dict[str, int]:
        """Get rate limiting configuration."""
        return {
            "default": self.default_rate_limit,
            "auth": self.auth_rate_limit,
            "upload": self.upload_rate_limit,
            "public": 200,  # Higher limit for public endpoints
            
            # Specific endpoint limits
            "POST:/api/v1/posts": 30,
            "POST:/api/v1/posts/*/reactions": 60,
            "POST:/api/v1/posts/*/share": 20,
            "POST:/api/v1/follows/*": 30,
            "GET:/api/v1/follows/*/status": 200,  # Higher limit for status checks
            "GET:/api/v1/users/*/followers": 100,
            "GET:/api/v1/users/*/following": 100,
            "GET:/api/v1/users/*/follow-stats": 150,
            "POST:/api/v1/users/search": 60,
            "GET:/api/v1/notifications": 120,
        }
    
    def get_request_size_limits(self) -> Dict[str, int]:
        """Get request size limits configuration."""
        return {
            "default": 1 * 1024 * 1024,  # 1MB
            "/api/v1/users/me/profile/photo": self.max_upload_size,
            "/api/v1/posts": 5 * 1024 * 1024,  # 5MB for posts with images
            "/api/v1/auth/login": 1024,  # 1KB
            "/api/v1/auth/signup": 2048,  # 2KB
            "/api/v1/auth/refresh": 1024,  # 1KB
        }


# Global security configuration instance
security_config = SecurityConfig()