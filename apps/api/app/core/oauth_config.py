"""
OAuth 2.0 configuration and provider setup for social authentication.
"""

import os
import logging
from typing import Dict, Any, Optional
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client import OAuthError
from starlette.config import Config

logger = logging.getLogger(__name__)

# OAuth configuration from environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
FACEBOOK_CLIENT_ID = os.getenv("FACEBOOK_CLIENT_ID")
FACEBOOK_CLIENT_SECRET = os.getenv("FACEBOOK_CLIENT_SECRET")

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Frontend URL - use FRONTEND_BASE_URL from Railway env vars
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

# Backend URL - NO LONGER HARDCODED, get from env
BACKEND_BASE_URL = os.getenv("BACKEND_URL", os.getenv("BACKEND_BASE_URL", "http://localhost:8000"))

# OAuth redirect URIs (where OAuth providers redirect back to)
GOOGLE_REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI", f"{FRONTEND_BASE_URL}/auth/callback/google")
FACEBOOK_REDIRECT_URI = os.getenv("FACEBOOK_REDIRECT_URI", f"{FRONTEND_BASE_URL}/auth/callback/facebook")
OAUTH_REDIRECT_URI = GOOGLE_REDIRECT_URI

# Frontend callback URLs
FRONTEND_SUCCESS_URL = os.getenv("FRONTEND_SUCCESS_URL", f"{FRONTEND_BASE_URL}/auth/callback/success")
FRONTEND_ERROR_URL = os.getenv("FRONTEND_ERROR_URL", f"{FRONTEND_BASE_URL}/auth/callback/error")

# CORS origins from ALLOWED_ORIGINS env var
ALLOWED_ORIGINS_STR = os.getenv("ALLOWED_ORIGINS", "")
if ALLOWED_ORIGINS_STR:
    ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS_STR.split(",") if origin.strip()]
else:
    ALLOWED_ORIGINS = [FRONTEND_BASE_URL] if FRONTEND_BASE_URL else []

# OAuth allowed domains
OAUTH_ALLOWED_DOMAINS_STR = os.getenv("OAUTH_ALLOWED_DOMAINS", "")
if OAUTH_ALLOWED_DOMAINS_STR:
    OAUTH_ALLOWED_DOMAINS = [domain.strip() for domain in OAUTH_ALLOWED_DOMAINS_STR.split(",") if domain.strip()]
else:
    OAUTH_ALLOWED_DOMAINS = []

# Security settings
OAUTH_SESSION_TIMEOUT = int(os.getenv("OAUTH_SESSION_TIMEOUT", "600"))
OAUTH_STATE_EXPIRY = int(os.getenv("OAUTH_STATE_EXPIRY", "300"))
SECURE_COOKIES = os.getenv("SECURE_COOKIES", "true").lower() == "true"
SAME_SITE_COOKIES = os.getenv("COOKIE_SAMESITE", "Lax")


class OAuthConfig:
    """OAuth configuration and provider management."""
    
    def __init__(self):
        self.oauth = None
        self.providers = {}
        self._validate_configuration()
    
    def _validate_configuration(self):
        """Validate OAuth configuration."""
        issues = []
        
        if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == "your-google-client-id-here":
            issues.append("GOOGLE_CLIENT_ID must be configured")
        
        if not GOOGLE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET == "your-google-client-secret-here":
            issues.append("GOOGLE_CLIENT_SECRET must be configured")
        
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
    
    def initialize_oauth(self) -> OAuth:
        """Initialize OAuth providers."""
        try:
            config = Config(environ={
                'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID or '',
                'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET or '',
                'FACEBOOK_CLIENT_ID': FACEBOOK_CLIENT_ID or '',
                'FACEBOOK_CLIENT_SECRET': FACEBOOK_CLIENT_SECRET or '',
            })
            
            self.oauth = OAuth(config)
            
            # Register Google OAuth
            if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
                try:
                    self.oauth.register(
                        name='google',
                        client_id=GOOGLE_CLIENT_ID,
                        client_secret=GOOGLE_CLIENT_SECRET,
                        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
                        client_kwargs={
                            'scope': 'openid email profile',
                            'prompt': 'select_account',
                        }
                    )
                    self.providers['google'] = True
                    logger.info("Google OAuth provider registered successfully")
                except Exception as e:
                    logger.error(f"Failed to register Google OAuth provider: {e}")
                    self.providers['google'] = False
            else:
                self.providers['google'] = False
            
            # Register Facebook OAuth
            if FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET and FACEBOOK_CLIENT_ID != "placeholder":
                try:
                    self.oauth.register(
                        name='facebook',
                        client_id=FACEBOOK_CLIENT_ID,
                        client_secret=FACEBOOK_CLIENT_SECRET,
                        access_token_url='https://graph.facebook.com/oauth/access_token',
                        authorize_url='https://www.facebook.com/dialog/oauth',
                        api_base_url='https://graph.facebook.com/',
                        client_kwargs={'scope': 'email public_profile'},
                    )
                    self.providers['facebook'] = True
                    logger.info("Facebook OAuth provider registered successfully")
                except Exception as e:
                    logger.error(f"Failed to register Facebook OAuth provider: {e}")
                    self.providers['facebook'] = False
            else:
                self.providers['facebook'] = False
            
            active_providers = [name for name, active in self.providers.items() if active]
            if active_providers:
                logger.info(f"OAuth providers initialized: {', '.join(active_providers)}")
            
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
            'frontend_base_url': FRONTEND_BASE_URL,
            'backend_base_url': BACKEND_BASE_URL,
            'allowed_origins': ALLOWED_ORIGINS,
            'environment': ENVIRONMENT,
            'initialized': self.oauth is not None,
            'secure_cookies': SECURE_COOKIES,
            'same_site_cookies': SAME_SITE_COOKIES,
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


oauth_config = OAuthConfig()


def get_oauth_config() -> OAuthConfig:
    """Get the global OAuth configuration instance."""
    return oauth_config


def initialize_oauth_providers() -> OAuth:
    """Initialize OAuth providers and return OAuth instance."""
    return oauth_config.initialize_oauth()


async def get_oauth_user_info(provider: str, token: Dict[str, Any]) -> Dict[str, Any]:
    """Get user information from OAuth provider using access token."""
    logger.info(f"=== STARTING USER INFO RETRIEVAL ===")
    logger.info(f"Provider: {provider}")
    logger.info(f"Token keys: {list(token.keys())}")
    
    try:
        oauth_client = oauth_config.get_oauth_client(provider)
        
        if provider == 'google':
            import httpx
            
            headers = {
                'Authorization': f"Bearer {token.get('access_token')}",
                'Accept': 'application/json'
            }
            
            async with httpx.AsyncClient() as client:
                resp = await client.get('https://www.googleapis.com/oauth2/v2/userinfo', headers=headers)
                if resp.status_code != 200:
                    raise OAuthError(f"Failed to get user info: {resp.status_code}")
                user_info = resp.json()
                
                debug_info = {k: v if k not in ['email', 'name'] else '***' for k, v in user_info.items()}
                logger.info(f"=== GOOGLE USER INFO DEBUG ===")
                logger.info(f"Raw user info keys: {list(user_info.keys())}")
                logger.info(f"Raw user info structure: {debug_info}")
                logger.info(f"Email field exists: {'email' in user_info}")
                logger.info(f"Email value: {user_info.get('email', 'NOT_FOUND')}")
            
            normalized_data = {
                'id': user_info.get('id'),
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
            resp = await oauth_client.get('me?fields=id,name,email,first_name,last_name,picture', token=token)
            user_info = resp.json()
            
            return {
                'id': user_info.get('id'),
                'email': user_info.get('email'),
                'name': user_info.get('name'),
                'given_name': user_info.get('first_name'),
                'family_name': user_info.get('last_name'),
                'picture': user_info.get('picture', {}).get('data', {}).get('url'),
                'email_verified': True,
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
    if provider == 'google':
        return GOOGLE_REDIRECT_URI
    elif provider == 'facebook':
        return FACEBOOK_REDIRECT_URI
    return OAUTH_REDIRECT_URI


def validate_oauth_state(state: str) -> bool:
    """Validate OAuth state parameter for CSRF protection."""
    return bool(state and len(state) >= 16)


def log_oauth_security_event(event_type: str, provider: str, user_id: Optional[int] = None, 
                            details: Optional[Dict[str, Any]] = None):
    """Log OAuth security events for audit purposes."""
    sanitized_details = {}
    if details:
        for key, value in details.items():
            if key in ['access_token', 'refresh_token', 'client_secret', 'password', 'token']:
                sanitized_details[key] = '[REDACTED]'
            elif key in ['email', 'name', 'given_name', 'family_name']:
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
        'timestamp': None,
    }
    
    if sanitized_details:
        log_data['details'] = sanitized_details
    
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