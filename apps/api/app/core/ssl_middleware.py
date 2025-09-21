"""
SSL/TLS Security Middleware for HTTPS enforcement and secure cookie handling.

This module provides comprehensive SSL/TLS security features:
- HTTPS redirect enforcement
- HSTS (HTTP Strict Transport Security) headers
- Secure cookie configuration
- SSL certificate validation utilities
"""

import os
import ssl
import socket
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.security_config import security_config

logger = logging.getLogger(__name__)


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce HTTPS redirects and SSL/TLS security.
    """
    
    def __init__(
        self, 
        app,
        force_https: bool = None,
        hsts_max_age: int = None,
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = True
    ):
        super().__init__(app)
        self.force_https = force_https if force_https is not None else security_config.ssl_redirect
        self.hsts_max_age = hsts_max_age if hsts_max_age is not None else security_config.hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload
        
        # Don't enforce HTTPS in development or testing unless explicitly configured
        if not security_config.is_production and force_https is None:
            self.force_https = False
            
        # Skip HTTPS enforcement during testing unless explicitly testing SSL
        if (os.getenv('TESTING') == 'true' or 
            os.getenv('PYTEST_CURRENT_TEST') is not None) and \
           os.getenv('SECURITY_TESTING') != 'true' and \
           force_https is None:  # Only override if not explicitly set
            self.force_https = False
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with HTTPS enforcement and security headers."""
        
        # Check if HTTPS redirect is needed
        if self.force_https and self._should_redirect_to_https(request):
            return self._create_https_redirect(request)
        
        # Process the request
        response = await call_next(request)
        
        # Add SSL/TLS security headers
        self._add_ssl_security_headers(request, response)
        
        return response
    
    def _should_redirect_to_https(self, request: Request) -> bool:
        """Determine if request should be redirected to HTTPS."""
        # Skip redirect for health checks and internal endpoints
        if request.url.path in ['/health', '/ready', '/metrics']:
            return False
        
        # Check if request is already HTTPS
        if request.url.scheme == 'https':
            return False
        
        # Check X-Forwarded-Proto header (for load balancers/proxies)
        forwarded_proto = request.headers.get('X-Forwarded-Proto', '').lower()
        if forwarded_proto == 'https':
            return False
        
        # Check X-Forwarded-SSL header
        forwarded_ssl = request.headers.get('X-Forwarded-SSL', '').lower()
        if forwarded_ssl in ['on', '1', 'true']:
            return False
        
        # Allow localhost in development
        if not security_config.is_production:
            host = request.headers.get('host', '').lower()
            if 'localhost' in host or '127.0.0.1' in host:
                return False
        
        return True
    
    def _create_https_redirect(self, request: Request) -> RedirectResponse:
        """Create HTTPS redirect response."""
        # Build HTTPS URL
        https_url = request.url.replace(scheme='https')
        
        # Log the redirect for monitoring
        logger.info(
            f"HTTPS redirect: {request.url} -> {https_url}",
            extra={
                "original_scheme": request.url.scheme,
                "target_scheme": "https",
                "path": request.url.path,
                "client_ip": request.client.host if request.client else "unknown"
            }
        )
        
        # Return permanent redirect (301) for HTTPS enforcement
        return RedirectResponse(url=str(https_url), status_code=301)
    
    def _add_ssl_security_headers(self, request: Request, response: Response):
        """Add SSL/TLS security headers to response."""
        # Add HSTS header for HTTPS requests
        if self._is_https_request(request):
            hsts_value = f"max-age={self.hsts_max_age}"
            
            if self.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            
            if self.hsts_preload:
                hsts_value += "; preload"
            
            response.headers["Strict-Transport-Security"] = hsts_value
        
        # Add secure cookie directives
        self._secure_cookies(response)
    
    def _is_https_request(self, request: Request) -> bool:
        """Check if request is over HTTPS."""
        # Direct HTTPS check
        if request.url.scheme == 'https':
            return True
        
        # Check proxy headers
        forwarded_proto = request.headers.get('X-Forwarded-Proto', '').lower()
        if forwarded_proto == 'https':
            return True
        
        forwarded_ssl = request.headers.get('X-Forwarded-SSL', '').lower()
        if forwarded_ssl in ['on', '1', 'true']:
            return True
        
        return False
    
    def _secure_cookies(self, response: Response):
        """Configure secure cookie settings."""
        # Get existing Set-Cookie headers
        set_cookie_headers = response.headers.getlist('set-cookie')
        
        if not set_cookie_headers:
            return
        
        # Remove existing Set-Cookie headers
        del response.headers['set-cookie']
        
        # Re-add with security attributes
        for cookie_header in set_cookie_headers:
            secured_cookie = self._add_cookie_security_attributes(cookie_header)
            response.headers.append('set-cookie', secured_cookie)
    
    def _add_cookie_security_attributes(self, cookie_header: str) -> str:
        """Add security attributes to cookie header."""
        # Parse cookie attributes
        parts = [part.strip() for part in cookie_header.split(';')]
        cookie_name_value = parts[0]
        attributes = parts[1:] if len(parts) > 1 else []
        
        # Convert attributes to lowercase for checking
        attr_lower = [attr.lower() for attr in attributes]
        
        # Add Secure attribute if not present and in production
        if security_config.is_production and 'secure' not in attr_lower:
            attributes.append('Secure')
        
        # Add HttpOnly attribute if not present (for non-JS accessible cookies)
        if 'httponly' not in attr_lower:
            # Only add HttpOnly for session/auth cookies, not for functional cookies
            cookie_name = cookie_name_value.split('=')[0].lower()
            if any(name in cookie_name for name in ['session', 'auth', 'token', 'csrf']):
                attributes.append('HttpOnly')
        
        # Add SameSite attribute if not present
        has_samesite = any('samesite' in attr.lower() for attr in attributes)
        if not has_samesite:
            # Use Lax for better compatibility while maintaining security
            attributes.append('SameSite=Lax')
        
        # Reconstruct cookie header
        return '; '.join([cookie_name_value] + attributes)


class SSLCertificateValidator:
    """
    Utilities for SSL certificate validation and monitoring.
    """
    
    @staticmethod
    def check_certificate_validity(hostname: str, port: int = 443) -> Dict[str, Any]:
        """
        Check SSL certificate validity for a given hostname.
        
        Args:
            hostname: Domain name to check
            port: SSL port (default: 443)
            
        Returns:
            Dict with certificate information and validity status
        """
        try:
            # Create SSL context
            context = ssl.create_default_context()
            
            # Connect and get certificate
            with socket.create_connection((hostname, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    
                    # Parse certificate information
                    subject = dict(x[0] for x in cert['subject'])
                    issuer = dict(x[0] for x in cert['issuer'])
                    
                    # Parse dates
                    not_before = datetime.strptime(cert['notBefore'], '%b %d %H:%M:%S %Y %Z')
                    not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                    
                    # Calculate validity
                    now = datetime.now()
                    is_valid = not_before <= now <= not_after
                    days_until_expiry = (not_after - now).days
                    
                    return {
                        'valid': is_valid,
                        'hostname': hostname,
                        'subject': subject,
                        'issuer': issuer,
                        'not_before': not_before.isoformat(),
                        'not_after': not_after.isoformat(),
                        'days_until_expiry': days_until_expiry,
                        'expires_soon': days_until_expiry <= 30,  # Warning if expires within 30 days
                        'serial_number': cert.get('serialNumber'),
                        'version': cert.get('version'),
                        'signature_algorithm': cert.get('signatureAlgorithm'),
                        'san': cert.get('subjectAltName', [])
                    }
                    
        except socket.timeout:
            return {
                'valid': False,
                'error': 'Connection timeout',
                'hostname': hostname
            }
        except socket.gaierror as e:
            return {
                'valid': False,
                'error': f'DNS resolution failed: {e}',
                'hostname': hostname
            }
        except ssl.SSLError as e:
            return {
                'valid': False,
                'error': f'SSL error: {e}',
                'hostname': hostname
            }
        except Exception as e:
            return {
                'valid': False,
                'error': f'Unexpected error: {e}',
                'hostname': hostname
            }
    
    @staticmethod
    def check_multiple_domains(domains: list) -> Dict[str, Dict[str, Any]]:
        """
        Check SSL certificates for multiple domains.
        
        Args:
            domains: List of domain names to check
            
        Returns:
            Dict mapping domain names to certificate information
        """
        results = {}
        
        for domain in domains:
            # Remove protocol if present
            clean_domain = domain.replace('https://', '').replace('http://', '')
            # Remove path if present
            clean_domain = clean_domain.split('/')[0]
            
            logger.info(f"Checking SSL certificate for {clean_domain}")
            results[domain] = SSLCertificateValidator.check_certificate_validity(clean_domain)
        
        return results
    
    @staticmethod
    def get_certificate_expiry_warnings(cert_results: Dict[str, Dict[str, Any]]) -> list:
        """
        Get warnings for certificates that are expiring soon.
        
        Args:
            cert_results: Results from check_multiple_domains
            
        Returns:
            List of warning messages
        """
        warnings = []
        
        for domain, result in cert_results.items():
            if not result.get('valid', False):
                warnings.append(f"SSL certificate invalid for {domain}: {result.get('error', 'Unknown error')}")
            elif result.get('expires_soon', False):
                days = result.get('days_until_expiry', 0)
                warnings.append(f"SSL certificate for {domain} expires in {days} days")
        
        return warnings


class SSLConfigurationManager:
    """
    Manager for SSL/TLS configuration and monitoring.
    """
    
    @staticmethod
    def get_ssl_configuration() -> Dict[str, Any]:
        """Get current SSL/TLS configuration."""
        return {
            'ssl_redirect_enabled': security_config.ssl_redirect,
            'hsts_max_age': security_config.hsts_max_age,
            'hsts_preload_enabled': True,  # Always enabled for security
            'secure_cookies_enabled': security_config.is_production,
            'allowed_origins': security_config.allowed_origins,
            'environment': security_config.environment,
            'production_mode': security_config.is_production
        }
    
    @staticmethod
    def validate_ssl_configuration() -> Dict[str, Any]:
        """Validate SSL/TLS configuration."""
        issues = []
        warnings = []
        recommendations = []
        
        # Check if SSL redirect is enabled in production
        if security_config.is_production and not security_config.ssl_redirect:
            issues.append("SSL redirect should be enabled in production")
        
        # Check HSTS max-age
        if security_config.hsts_max_age < 31536000:  # 1 year
            warnings.append("HSTS max-age should be at least 1 year (31536000 seconds)")
        
        # Check allowed origins for HTTPS
        if security_config.is_production:
            for origin in security_config.allowed_origins:
                if origin.startswith('http://') and 'localhost' not in origin:
                    issues.append(f"Production origin should use HTTPS: {origin}")
        
        # Recommendations
        if security_config.hsts_max_age < 63072000:  # 2 years
            recommendations.append("Consider increasing HSTS max-age to 2 years for better security")
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations
        }
    
    @staticmethod
    def check_domain_certificates(domains: Optional[list] = None) -> Dict[str, Any]:
        """
        Check SSL certificates for configured domains.
        
        Args:
            domains: List of domains to check (defaults to allowed origins)
            
        Returns:
            Dict with certificate check results
        """
        if domains is None:
            # Extract domains from allowed origins
            domains = []
            for origin in security_config.allowed_origins:
                if origin.startswith('https://'):
                    domain = origin.replace('https://', '').split('/')[0]
                    domains.append(domain)
        
        if not domains:
            return {
                'checked': False,
                'reason': 'No HTTPS domains configured to check'
            }
        
        cert_results = SSLCertificateValidator.check_multiple_domains(domains)
        warnings = SSLCertificateValidator.get_certificate_expiry_warnings(cert_results)
        
        # Calculate summary
        total_domains = len(cert_results)
        valid_certs = sum(1 for result in cert_results.values() if result.get('valid', False))
        expiring_soon = sum(1 for result in cert_results.values() if result.get('expires_soon', False))
        
        return {
            'checked': True,
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_domains': total_domains,
                'valid_certificates': valid_certs,
                'invalid_certificates': total_domains - valid_certs,
                'expiring_soon': expiring_soon
            },
            'results': cert_results,
            'warnings': warnings
        }


def create_ssl_middleware(app):
    """
    Create and configure SSL middleware for the application.
    
    Args:
        app: FastAPI application instance
        
    Returns:
        Configured HTTPSRedirectMiddleware
    """
    return HTTPSRedirectMiddleware(
        app,
        force_https=security_config.ssl_redirect,
        hsts_max_age=security_config.hsts_max_age,
        hsts_include_subdomains=True,
        hsts_preload=True
    )