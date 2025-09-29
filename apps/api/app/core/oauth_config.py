"""
OAuth 2.0 configuration and provider setup for social authentication.
"""

import os
import logging
from typing import Dict, Any, Optional
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client import OAuthError
from starlette.config import Config
from starlette.datastructures import Secret

logger = logging.getLogger(__name__)

# OAuth configuration from environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
FACEBOOK_CLIENT_ID = os.getenv("FACEBOOK_CLIENT_ID")
FACEBOOK_CLIENT_SECRET = os.getenv("FACEBOOK_CLIENT_SECRET")

# OAuth allowed domains configuration
OAUTH_ALLOWED_DOMAINS = os.getenv(
    "OAUTH_ALLOWED_DOMAINS", 
    "grateful-net.vercel.app,www.grateful-net.vercel.app,grateful-production.vercel.app"
).split(",") if os.getenv("OAUTH_ALLOWED_DOMAINS") else [
    "grateful-net.vercel.app", 
    "www.grateful-net.vercel.app",
    "grateful-production.vercel.app"
]
# Production-aware OAuth redirect URI configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Production OAuth configuration
if ENVIRONMENT == "production":
    # Production URLs - Railway backend, Vercel frontend
    FRONTEND_BASE_URL = os.getenv("FRONTEND_URL", "https://grateful-net.vercel.app")
    BACKEND_BASE_URL = os.getenv("BACKEND_URL", "https://grateful-production.up.railway.app")
    
    # OAuth redirect URIs (where OAuth providers redirect back to frontend)
    GOOGLE_REDIRECT_URI = f"{FRONTEND_BASE_URL}/auth/callback/google"
    FACEBOOK_REDIRECT_URI = f"{FRONTEND_BASE_URL}/auth/callback/facebook"
    
    # Frontend callback URLs (where users are redirected after OAuth processing)
    FRONTEND_SUCCESS_URL = f"{FRONTEND_BASE_URL}/auth/callback/success"
    FRONTEND_ERROR_URL = f"{FRONTEND_BASE_URL}/auth/callback/error"
    
    # Production CORS origins
    ALLOWED_ORIGINS = [
        "https://grateful-net.vercel.app",
        "https://www.grateful-net.vercel.app",
        "https://grateful-production.up.railway.app",
        os.getenv("CUSTOM_DOMAIN", "").strip()
    ]
    
elif ENVIRONMENT == "staging":
    # Staging URLs
    FRONTEND_BASE_URL = os.getenv("FRONTEND_URL", "https://grateful-staging.vercel.app")
    BACKEND_BASE_URL = os.getenv("BACKEND_URL", "https://grateful-staging.up.railway.app")
    
    GOOGLE_REDIRECT_URI = f"{FRONTEND_BASE_URL}/auth/callback/google"
    FACEBOOK_REDIRECT_URI = f"{FRONTEND_BASE_URL}/auth/callback/facebook"
    
    FRONTEND_SUCCESS_URL = f"{FRONTEND_BASE_URL}/auth/callback/success"
    FRONTEND_ERROR_URL = f"{FRONTEND_BASE_URL}/auth/callback/error"
    
    ALLOWED_ORIGINS = [
        "https://grateful-staging.vercel.app",
        "https://grateful-staging.up.railway.app"
    ]
    
else:
    # Development URLs
    FRONTEND_BASE_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    BACKEND_BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    # OAuth redirect URIs should point to frontend for proper flow
    GOOGLE_REDIRECT_URI = f"{FRONTEND_BASE_URL}/auth/callback/google"
    FACEBOOK_REDIRECT_URI = f"{FRONTEND_BASE_URL}/auth/callback/facebook"
    
    FRONTEND_SUCCESS_URL = f"{FRONTEND_BASE_URL}/auth/callback/success"
    FRONTEND_ERROR_URL = f"{FRONTEND_BASE_URL}/auth/callback/error"
    
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]

# Remove empty strings from allowed origins
ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if origin]

# Legacy support for existing OAUTH_REDIRECT_URI
OAUTH_REDIRECT_URI = GOOGLE_REDIRECT_URI

# Production security settings
OAUTH_SESSION_TIMEOUT = int(os.getenv("OAUTH_SESSION_TIMEOUT", "600"))  # 10 minutes
OAUTH_STATE_EXPIRY = int(os.getenv("OAUTH_STATE_EXPIRY", "300"))  # 5 minutes
SECURE_COOKIES = ENVIRONMENT == "production"
SAME_SITE_COOKIES = "none" if ENVIRONMENT == "production" else "lax"

# Environment is already defined above for redirect URI configuration

class OAuthConfig:
    """OAuth configuration and provider management."""
    
    def __init__(self):
        self.oauth = None
        self.providers = {}
        self._validate_configuration()
    
    def _validate_configuration(self):
        """Validate OAuth configuration for production deployment."""
        issues = []
        
        # Check Google OAuth configuration (required)
        if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == "your-google-client-id-here":
            issues.append("GOOGLE_CLIENT_ID must be configured")
        
        if not GOOGLE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET == "your-google-client-secret-here":
            issues.append("GOOGLE_CLIENT_SECRET must be configured")
        
        # Check Facebook OAuth configuration (optional - only validate if provided)
        facebook_configured = (FACEBOOK_CLIENT_ID and 
                             FACEBOOK_CLIENT_ID != "your-facebook-client-id-here" and
                             FACEBOOK_CLIENT_SECRET and 
                             FACEBOOK_CLIENT_SECRET != "your-facebook-client-secret-here")
        
        if FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_ID != "your-facebook-client-id-here":
            if not FACEBOOK_CLIENT_SECRET or FACEBOOK_CLIENT_SECRET == "your-facebook-client-secret-here":
                issues.append("FACEBOOK_CLIENT_SECRET must be configured when FACEBOOK_CLIENT_ID is provided")
        
        if FACEBOOK_CLIENT_SECRET and FACEBOOK_CLIENT_SECRET != "your-facebook-client-secret-here":
            if not FACEBOOK_CLIENT_ID or FACEBOOK_CLIENT_ID == "your-facebook-client-id-here":
                issues.append("FACEBOOK_CLIENT_ID must be configured when FACEBOOK_CLIENT_SECRET is provided")
        
        # Check redirect URI
        if not OAUTH_REDIRECT_URI:
            issues.append("OAUTH_REDIRECT_URI must be configured")
        
        # Log configuration issues
        if issues:
            if ENVIRONMENT == "production":
                logger.error("OAuth configuration issues detected in production:")
                for issue in issues:
                    logger.error(f"  - {issue}")
                raise ValueError("Critical OAuth configuration issues prevent production startup")
            else:
                logger.warning("OAuth configuration issues detected:")
                for issue in issues:
                    logger.warning(f"  - {issue}")
                logger.warning("OAuth providers will be disabled until configuration is complete")
    
    def initialize_oauth(self) -> OAuth:
        """Initialize OAuth providers with proper error handling."""
        try:
            # Create Starlette config for OAuth
            config = Config(environ={
                'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID or '',
                'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET or '',
                'FACEBOOK_CLIENT_ID': FACEBOOK_CLIENT_ID or '',
                'FACEBOOK_CLIENT_SECRET': FACEBOOK_CLIENT_SECRET or '',
            })
            
            # Initialize OAuth instance
            self.oauth = OAuth(config)
            
            # Register Google OAuth provider
            if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
                try:
                    self.oauth.register(
                        name='google',
                        client_id=GOOGLE_CLIENT_ID,
                        client_secret=GOOGLE_CLIENT_SECRET,
                        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
                        client_kwargs={
                            'scope': 'openid email profile',
                            'prompt': 'select_account',  # Force account selection
                            # Disable PKCE for server-side token exchange
                        }
                    )
                    self.providers['google'] = True
                    logger.info("Google OAuth provider registered successfully")
                except Exception as e:
                    logger.error(f"Failed to register Google OAuth provider: {e}")
                    self.providers['google'] = False
            else:
                logger.warning("Google OAuth provider not configured")
                self.providers['google'] = False
            
            # Register Facebook OAuth provider
            if FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET:
                try:
                    self.oauth.register(
                        name='facebook',
                        client_id=FACEBOOK_CLIENT_ID,
                        client_secret=FACEBOOK_CLIENT_SECRET,
                        access_token_url='https://graph.facebook.com/oauth/access_token',
                        authorize_url='https://www.facebook.com/dialog/oauth',
                        api_base_url='https://graph.facebook.com/',
                        client_kwargs={
                            'scope': 'email public_profile',
                            # Disable PKCE for server-side token exchange
                        },
                    )
                    self.providers['facebook'] = True
                    logger.info("Facebook OAuth provider registered successfully")
                except Exception as e:
                    logger.error(f"Failed to register Facebook OAuth provider: {e}")
                    self.providers['facebook'] = False
            else:
                logger.warning("Facebook OAuth provider not configured")
                self.providers['facebook'] = False
            
            # Log provider status
            active_providers = [name for name, active in self.providers.items() if active]
            if active_providers:
                logger.info(f"OAuth providers initialized: {', '.join(active_providers)}")
            else:
                logger.warning("No OAuth providers are active")
            
            return self.oauth
            
        except Exception as e:
            logger.error(f"Failed to initialize OAuth providers: {e}")
            self.oauth = None
            self.providers = {}
            raise
    
    def get_provider_status(self) -> Dict[str, Any]:
        """Get status of all OAuth providers."""
        return {
            'providers': self.providers.copy(),
            'redirect_uri': OAUTH_REDIRECT_URI,
            'google_redirect_uri': GOOGLE_REDIRECT_URI,
            'facebook_redirect_uri': FACEBOOK_REDIRECT_URI,
            'frontend_success_url': FRONTEND_SUCCESS_URL,
            'frontend_error_url': FRONTEND_ERROR_URL,
            'allowed_origins': ALLOWED_ORIGINS,
            'environment': ENVIRONMENT,
            'initialized': self.oauth is not None,
            'secure_cookies': SECURE_COOKIES,
            'session_timeout': OAUTH_SESSION_TIMEOUT
        }
    
    def is_provider_available(self, provider_name: str) -> bool:
        """Check if a specific OAuth provider is available."""
        return self.providers.get(provider_name, False)
    
    def get_oauth_client(self, provider_name: str):
        """Get OAuth client for a specific provider."""
        if not self.oauth:
            raise ValueError("OAuth not initialized")
        
        if not self.is_provider_available(provider_name):
            raise ValueError(f"OAuth provider '{provider_name}' is not available")
        
        return getattr(self.oauth, provider_name)

# Global OAuth configuration instance
oauth_config = OAuthConfig()

def get_oauth_config() -> OAuthConfig:
    """Get the global OAuth configuration instance."""
    return oauth_config

def initialize_oauth_providers() -> OAuth:
    """Initialize OAuth providers and return OAuth instance."""
    return oauth_config.initialize_oauth()

async def get_oauth_user_info(provider: str, token: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get user information from OAuth provider using access token.
    
    Args:
        provider: OAuth provider name ('google' or 'facebook')
        token: OAuth token dictionary
        
    Returns:
        Dict containing user information
        
    Raises:
        ValueError: If provider is not supported
        OAuthError: If OAuth request fails
    """
    logger.info(f"=== STARTING USER INFO RETRIEVAL ===")
    logger.info(f"Provider: {provider}")
    logger.info(f"Token keys: {list(token.keys())}")
    
    try:
        oauth_client = oauth_config.get_oauth_client(provider)
        
        if provider == 'google':
            # Get user info from Google using full URL
            import httpx
            
            # Use the access token to get user info directly from Google
            headers = {
                'Authorization': f"Bearer {token.get('access_token')}",
                'Accept': 'application/json'
            }
            
            async with httpx.AsyncClient() as client:
                resp = await client.get('https://www.googleapis.com/oauth2/v2/userinfo', headers=headers)
                if resp.status_code != 200:
                    raise OAuthError(f"Failed to get user info: {resp.status_code}")
                user_info = resp.json()
                
                # Debug: Log the user info structure (mask sensitive data)
                debug_info = {k: v if k not in ['email', 'name'] else '***' for k, v in user_info.items()}
                logger.info(f"=== GOOGLE USER INFO DEBUG ===")
                logger.info(f"Raw user info keys: {list(user_info.keys())}")
                logger.info(f"Raw user info structure: {debug_info}")
                logger.info(f"Email field exists: {'email' in user_info}")
                logger.info(f"Email value: {user_info.get('email', 'NOT_FOUND')}")
            
            # Normalize Google user info
            normalized_data = {
                'id': user_info.get('id'),  # Google userinfo returns 'id', not 'sub'
                'email': user_info.get('email'),
                'name': user_info.get('name'),
                'given_name': user_info.get('given_name'),
                'family_name': user_info.get('family_name'),
                'picture': user_info.get('picture'),
                'email_verified': user_info.get('verified_email', False),
                'locale': user_info.get('locale'),
                'provider': 'google'
            }
            
            logger.info(f"=== NORMALIZED DATA DEBUG ===")
            logger.info(f"Normalized data keys: {list(normalized_data.keys())}")
            logger.info(f"Normalized email: {normalized_data.get('email', 'NOT_FOUND')}")
            
            return normalized_data
            
        elif provider == 'facebook':
            # Get user info from Facebook
            resp = await oauth_client.get('me?fields=id,name,email,first_name,last_name,picture', token=token)
            user_info = resp.json()
            
            # Normalize Facebook user info
            return {
                'id': user_info.get('id'),
                'email': user_info.get('email'),
                'name': user_info.get('name'),
                'given_name': user_info.get('first_name'),
                'family_name': user_info.get('last_name'),
                'picture': user_info.get('picture', {}).get('data', {}).get('url'),
                'email_verified': True,  # Facebook emails are generally verified
                'locale': None,
                'provider': 'facebook'
            }
            
        else:
            raise ValueError(f"Unsupported OAuth provider: {provider}")
            
    except OAuthError as e:
        logger.error(f"OAuth error getting user info from {provider}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting user info from {provider}: {e}")
        raise

def get_oauth_redirect_uri(provider: str) -> str:
    """Get the OAuth redirect URI for a specific provider."""
    return OAUTH_REDIRECT_URI

def validate_oauth_state(state: str) -> bool:
    """
    Validate OAuth state parameter for CSRF protection.
    
    Args:
        state: State parameter from OAuth callback
        
    Returns:
        bool: True if state is valid
    """
    # Basic state validation - in production, implement proper CSRF token validation
    return bool(state and len(state) >= 16)

# Security audit logging for OAuth operations
def log_oauth_security_event(event_type: str, provider: str, user_id: Optional[int] = None, 
                            details: Optional[Dict[str, Any]] = None):
    """
    Log OAuth security events for audit purposes with production-safe sanitization.
    
    Args:
        event_type: Type of OAuth event ('login_attempt', 'login_success', 'login_failure', etc.)
        provider: OAuth provider name
        user_id: User ID if available
        details: Additional event details (will be sanitized for production)
    """
    # Sanitize details for production logging (remove sensitive data)
    sanitized_details = {}
    if details:
        for key, value in details.items():
            if key in ['access_token', 'refresh_token', 'client_secret', 'password', 'token']:
                sanitized_details[key] = '[REDACTED]'
            elif key in ['email', 'name', 'given_name', 'family_name']:
                # Hash PII for production logging
                if ENVIRONMENT == "production" and value:
                    import hashlib
                    sanitized_details[key] = hashlib.sha256(str(value).encode()).hexdigest()[:8] + '...'
                else:
                    sanitized_details[key] = value
            elif key == 'error' and isinstance(value, Exception):
                sanitized_details[key] = str(value)
            else:
                sanitized_details[key] = value
    
    log_data = {
        'event_type': event_type,
        'provider': provider,
        'user_id': user_id,
        'environment': ENVIRONMENT,
        'timestamp': None,  # Will be added by structured logging
    }
    
    if sanitized_details:
        log_data['details'] = sanitized_details
    
    # Use appropriate log level based on event type
    if event_type in ['login_failure', 'invalid_state', 'token_error', 'oauth_error']:
        logger.error(f"OAuth security event: {event_type}", extra=log_data)
    elif event_type in ['invalid_redirect', 'csrf_violation', 'provider_unavailable']:
        logger.warning(f"OAuth security event: {event_type}", extra=log_data)
    else:
        logger.info(f"OAuth event: {event_type}", extra=log_data)

def log_oauth_production_error(error_type: str, provider: str, error_details: str, 
                              user_context: Optional[Dict[str, Any]] = None):
    """
    Log OAuth production errors with enhanced monitoring for production deployment.
    
    Args:
        error_type: Type of OAuth error ('config_error', 'provider_error', 'token_error', etc.)
        provider: OAuth provider name
        error_details: Error description (will be sanitized)
        user_context: Optional user context (will be sanitized)
    """
    # Sanitize error details for production
    sanitized_error = error_details
    if ENVIRONMENT == "production":
        # Remove potentially sensitive information from error messages
        sensitive_patterns = [
            r'client_secret=[^&\s]+',
            r'access_token=[^&\s]+',
            r'refresh_token=[^&\s]+',
            r'password=[^&\s]+',
            r'token=[^&\s]+',
        ]
        import re
        for pattern in sensitive_patterns:
            sanitized_error = re.sub(pattern, '[REDACTED]', sanitized_error, flags=re.IGNORECASE)
    
    # Sanitize user context
    sanitized_context = {}
    if user_context:
        for key, value in user_context.items():
            if key in ['email', 'name']:
                if ENVIRONMENT == "production" and value:
                    import hashlib
                    sanitized_context[key] = hashlib.sha256(str(value).encode()).hexdigest()[:8] + '...'
                else:
                    sanitized_context[key] = value
            elif key not in ['access_token', 'refresh_token', 'client_secret', 'password']:
                sanitized_context[key] = value
    
    log_data = {
        'error_type': error_type,
        'provider': provider,
        'error_details': sanitized_error,
        'environment': ENVIRONMENT,
        'production_safe': True,
        'timestamp': None,  # Will be added by structured logging
    }
    
    if sanitized_context:
        log_data['user_context'] = sanitized_context
    
    # Enhanced production error monitoring
    if ENVIRONMENT == "production":
        # Add additional production monitoring context
        log_data.update({
            'severity': 'HIGH' if error_type in ['config_error', 'token_error', 'provider_error'] else 'MEDIUM',
            'requires_attention': error_type in ['config_error', 'provider_unavailable', 'token_exchange_failed'],
            'user_impact': 'OAuth login functionality affected',
            'recommended_action': get_oauth_error_recommendation(error_type)
        })
    
    logger.error(f"OAuth production error: {error_type}", extra=log_data)

def get_oauth_error_recommendation(error_type: str) -> str:
    """Get recommended action for OAuth error types."""
    recommendations = {
        'config_error': 'Check OAuth provider configuration and credentials',
        'provider_error': 'Verify OAuth provider service status and API limits',
        'token_error': 'Check OAuth token exchange configuration and network connectivity',
        'authentication_failure': 'Review OAuth flow implementation and user permissions',
        'provider_unavailable': 'Check OAuth provider service status and configuration',
        'token_exchange_failed': 'Verify OAuth redirect URIs and client configuration',
        'user_creation_failure': 'Check database connectivity and user model constraints',
        'linking_validation_failed': 'Review account linking logic and conflict resolution'
    }
    return recommendations.get(error_type, 'Review OAuth configuration and logs for details')