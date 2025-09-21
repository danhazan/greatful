"""
SSL/TLS Security Management API endpoints.

This module provides endpoints for:
- SSL certificate validation and monitoring
- HTTPS configuration management
- Security status reporting
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.core.ssl_middleware import SSLConfigurationManager, SSLCertificateValidator
from app.core.security_config import security_config
from app.core.responses import success_response
from app.core.exceptions import ValidationException
from app.core.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


class SSLConfigurationResponse(BaseModel):
    """SSL configuration response model."""
    ssl_redirect_enabled: bool = Field(..., description="Whether HTTPS redirect is enabled")
    hsts_max_age: int = Field(..., description="HSTS max-age in seconds")
    hsts_preload_enabled: bool = Field(..., description="Whether HSTS preload is enabled")
    secure_cookies_enabled: bool = Field(..., description="Whether secure cookies are enabled")
    environment: str = Field(..., description="Current environment")
    production_mode: bool = Field(..., description="Whether running in production mode")


class CertificateCheckRequest(BaseModel):
    """Request model for certificate checking."""
    domains: List[str] = Field(..., description="List of domains to check", min_length=1, max_length=10)


class CertificateInfo(BaseModel):
    """Certificate information model."""
    valid: bool = Field(..., description="Whether certificate is valid")
    hostname: str = Field(..., description="Hostname checked")
    subject: Optional[Dict[str, str]] = Field(None, description="Certificate subject")
    issuer: Optional[Dict[str, str]] = Field(None, description="Certificate issuer")
    not_before: Optional[str] = Field(None, description="Certificate valid from date")
    not_after: Optional[str] = Field(None, description="Certificate valid until date")
    days_until_expiry: Optional[int] = Field(None, description="Days until certificate expires")
    expires_soon: Optional[bool] = Field(None, description="Whether certificate expires within 30 days")
    error: Optional[str] = Field(None, description="Error message if certificate check failed")


class CertificateCheckResponse(BaseModel):
    """Certificate check response model."""
    checked: bool = Field(..., description="Whether certificates were checked")
    timestamp: Optional[str] = Field(None, description="Check timestamp")
    summary: Optional[Dict[str, int]] = Field(None, description="Summary of certificate status")
    results: Optional[Dict[str, CertificateInfo]] = Field(None, description="Detailed certificate results")
    warnings: Optional[List[str]] = Field(None, description="Certificate warnings")
    reason: Optional[str] = Field(None, description="Reason if certificates were not checked")


@router.get("/configuration", response_model=SSLConfigurationResponse)
async def get_ssl_configuration(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get current SSL/TLS configuration.
    
    Requires authentication to prevent information disclosure.
    """
    try:
        config = SSLConfigurationManager.get_ssl_configuration()
        
        logger.info(
            "SSL configuration requested",
            extra={
                "user_id": current_user.id,
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            data=SSLConfigurationResponse(**config),
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to get SSL configuration: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve SSL configuration")


@router.get("/validation")
async def validate_ssl_configuration(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Validate current SSL/TLS configuration.
    
    Returns validation results with issues, warnings, and recommendations.
    """
    try:
        validation_result = SSLConfigurationManager.validate_ssl_configuration()
        
        logger.info(
            "SSL configuration validation requested",
            extra={
                "user_id": current_user.id,
                "validation_result": validation_result['valid'],
                "issues_count": len(validation_result['issues']),
                "warnings_count": len(validation_result['warnings']),
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            data=validation_result,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to validate SSL configuration: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate SSL configuration")


@router.get("/certificates", response_model=CertificateCheckResponse)
async def check_domain_certificates(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Check SSL certificates for configured domains.
    
    Checks certificates for all HTTPS domains in allowed origins.
    """
    try:
        cert_results = SSLConfigurationManager.check_domain_certificates()
        
        logger.info(
            "Domain certificate check requested",
            extra={
                "user_id": current_user.id,
                "domains_checked": cert_results.get('summary', {}).get('total_domains', 0),
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            data=CertificateCheckResponse(**cert_results),
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to check domain certificates: {e}")
        raise HTTPException(status_code=500, detail="Failed to check domain certificates")


@router.post("/certificates/check", response_model=CertificateCheckResponse)
async def check_specific_certificates(
    request: Request,
    cert_request: CertificateCheckRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Check SSL certificates for specific domains.
    
    Allows checking certificates for custom domains not in the configuration.
    """
    try:
        # Validate domains
        for domain in cert_request.domains:
            if not domain or len(domain) > 253:  # Max domain length
                raise ValidationException(
                    f"Invalid domain: {domain}",
                    {"domain": "Domain must be valid and not exceed 253 characters"}
                )
        
        cert_results = SSLConfigurationManager.check_domain_certificates(cert_request.domains)
        
        logger.info(
            "Specific certificate check requested",
            extra={
                "user_id": current_user.id,
                "domains": cert_request.domains,
                "domains_checked": len(cert_request.domains),
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            data=CertificateCheckResponse(**cert_results),
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except ValidationException:
        raise
    except Exception as e:
        logger.error(f"Failed to check specific certificates: {e}")
        raise HTTPException(status_code=500, detail="Failed to check certificates")


@router.get("/status")
async def get_ssl_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive SSL/TLS security status.
    
    Combines configuration, validation, and certificate check results.
    """
    try:
        # Get configuration
        config = SSLConfigurationManager.get_ssl_configuration()
        
        # Validate configuration
        validation = SSLConfigurationManager.validate_ssl_configuration()
        
        # Check certificates
        certificates = SSLConfigurationManager.check_domain_certificates()
        
        # Calculate overall status
        overall_status = "healthy"
        if not validation['valid'] or (certificates.get('checked') and 
                                     certificates.get('summary', {}).get('invalid_certificates', 0) > 0):
            overall_status = "issues"
        elif (validation['warnings'] or 
              (certificates.get('checked') and certificates.get('warnings'))):
            overall_status = "warnings"
        
        status_report = {
            "overall_status": overall_status,
            "timestamp": certificates.get('timestamp'),
            "configuration": config,
            "validation": validation,
            "certificates": certificates
        }
        
        logger.info(
            "SSL status report requested",
            extra={
                "user_id": current_user.id,
                "overall_status": overall_status,
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            data=status_report,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to get SSL status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve SSL status")


@router.get("/health")
async def ssl_health_check(request: Request):
    """
    Public SSL health check endpoint.
    
    Returns basic SSL configuration status without sensitive information.
    Does not require authentication for monitoring systems.
    """
    try:
        # Basic configuration check
        config_valid = True
        issues = []
        
        # Check if HTTPS is properly configured in production
        if security_config.is_production:
            if not security_config.ssl_redirect:
                config_valid = False
                issues.append("HTTPS redirect not enabled in production")
            
            # Check if any origins are HTTP in production
            http_origins = [origin for origin in security_config.allowed_origins 
                          if origin.startswith('http://') and 'localhost' not in origin]
            if http_origins:
                config_valid = False
                issues.append("HTTP origins found in production configuration")
        
        status = "healthy" if config_valid else "unhealthy"
        
        response_data = {
            "status": status,
            "ssl_redirect_enabled": security_config.ssl_redirect,
            "hsts_enabled": security_config.is_production,
            "environment": security_config.environment,
            "timestamp": SSLConfigurationManager.check_domain_certificates().get('timestamp')
        }
        
        if issues:
            response_data["issues"] = issues
        
        return JSONResponse(
            content=response_data,
            status_code=200 if config_valid else 503
        )
        
    except Exception as e:
        logger.error(f"SSL health check failed: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "error": "Health check failed"
            },
            status_code=503
        )