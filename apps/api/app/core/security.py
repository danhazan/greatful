"""
Security utilities for JWT token handling and password hashing.
"""

import jwt
import os
import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Production-grade security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"

# Production-ready token expiration times with security validation
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # 1 hour default
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))  # 30 days default

# Production security validation
def _validate_production_security():
    """Validate security configuration for production deployment."""
    issues = []
    
    # Validate secret key
    if SECRET_KEY == "your-super-secret-key-change-this-in-production":
        issues.append("SECRET_KEY must be changed from default value")
    
    if len(SECRET_KEY) < 32:
        issues.append("SECRET_KEY should be at least 32 characters long")
    
    # Validate token expiration times
    if ACCESS_TOKEN_EXPIRE_MINUTES > 1440:  # 24 hours
        logger.warning("ACCESS_TOKEN_EXPIRE_MINUTES exceeds 24 hours - consider shorter expiration")
    
    if REFRESH_TOKEN_EXPIRE_DAYS > 90:  # 90 days
        logger.warning("REFRESH_TOKEN_EXPIRE_DAYS exceeds 90 days - consider shorter expiration")
    
    # Check environment
    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production" and issues:
        logger.error("Production security issues detected:")
        for issue in issues:
            logger.error(f"  - {issue}")
        if "SECRET_KEY" in str(issues):
            raise ValueError("Critical security configuration issues prevent production startup")
    elif issues:
        logger.warning("Security configuration issues detected:")
        for issue in issues:
            logger.warning(f"  - {issue}")

# Validate security configuration on module load
_validate_production_security()

# Password hashing with stronger configuration
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__rounds=12  # Increased rounds for better security
)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a production-grade JWT access token with enhanced security.
    
    Args:
        data: Dictionary containing token data (usually user info)
        expires_delta: Optional custom expiration time
        
    Returns:
        str: Encoded JWT token with security enhancements
    """
    to_encode = data.copy()
    current_time = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = current_time + expires_delta
    else:
        expire = current_time + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add standard JWT claims with enhanced security
    to_encode.update({
        "exp": expire,
        "iat": current_time,
        "nbf": current_time,  # Not before - token not valid before this time
        "jti": secrets.token_urlsafe(32),  # JWT ID for token revocation
        "type": "access",
        "iss": "grateful-api",  # Issuer
        "aud": "grateful-client",  # Audience
        # Add security context
        "sec": {
            "version": "1.0",
            "created": current_time.isoformat()
        }
    })
    
    # Validate token data before encoding
    if "sub" not in to_encode:
        raise ValueError("Token must contain 'sub' (subject) claim")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Create a production-grade JWT refresh token with enhanced security.
    
    Args:
        data: Dictionary containing token data (usually user info)
        
    Returns:
        str: Encoded JWT refresh token with security enhancements
    """
    to_encode = data.copy()
    current_time = datetime.now(timezone.utc)
    expire = current_time + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Add enhanced security claims
    to_encode.update({
        "exp": expire,
        "iat": current_time,
        "nbf": current_time,  # Not before
        "jti": secrets.token_urlsafe(32),
        "type": "refresh",
        "iss": "grateful-api",  # Issuer
        "aud": "grateful-client",  # Audience
        # Add security context for refresh tokens
        "sec": {
            "version": "1.0",
            "created": current_time.isoformat(),
            "refresh_count": 0  # Track refresh usage
        }
    })
    
    # Validate token data before encoding
    if "sub" not in to_encode:
        raise ValueError("Refresh token must contain 'sub' (subject) claim")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str, token_type: str = "access") -> Dict[str, Any]:
    """
    Decode and validate a JWT token with enhanced security validation.
    
    Args:
        token: JWT token string
        token_type: Expected token type ("access" or "refresh")
        
    Returns:
        Dict[str, Any]: Decoded token payload
        
    Raises:
        jwt.PyJWTError: If token is invalid or expired
        ValueError: If token validation fails
    """
    try:
        # Decode with comprehensive validation
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            # Enable additional validations
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
                "verify_aud": True,
                "verify_iss": True,
                "require": ["exp", "iat", "nbf", "jti", "sub", "type"]
            },
            audience="grateful-client",
            issuer="grateful-api"
        )
        
        # Validate token type
        token_type_in_payload = payload.get("type")
        if token_type_in_payload != token_type:
            raise ValueError(f"Invalid token type. Expected {token_type}, got {token_type_in_payload}")
        
        # Additional security validations
        current_time = datetime.now(timezone.utc)
        
        # Check if token is not used before its time
        nbf = payload.get("nbf")
        if nbf and datetime.fromtimestamp(nbf, tz=timezone.utc) > current_time:
            raise ValueError("Token not yet valid (nbf claim)")
        
        # Validate JWT ID exists and has minimum length
        jti = payload.get("jti", "")
        if len(jti) < 16:
            raise ValueError("Invalid JWT ID (jti) - insufficient entropy")
        
        # Validate security context if present
        sec = payload.get("sec", {})
        if sec and "version" in sec:
            if sec["version"] != "1.0":
                logger.warning(f"Token security version mismatch: {sec['version']}")
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        raise
    except ValueError as e:
        logger.warning(f"Token validation failed: {e}")
        raise


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password from database
        
    Returns:
        bool: True if password matches
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password.
    
    Args:
        password: Plain text password
        
    Returns:
        str: Hashed password
    """
    return pwd_context.hash(password)


