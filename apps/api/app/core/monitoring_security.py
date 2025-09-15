"""
Security configuration for monitoring endpoints.
"""

import os
import logging
from typing import List, Optional
from fastapi import HTTPException, Request, status
from ipaddress import ip_address, ip_network

logger = logging.getLogger(__name__)


class MonitoringSecurityConfig:
    """Security configuration for monitoring endpoints."""
    
    def __init__(self):
        # Load configuration from environment
        self.allowed_ips = self._parse_allowed_ips()
        self.monitoring_token = os.getenv("MONITORING_TOKEN")
        self.enable_ip_whitelist = os.getenv("ENABLE_MONITORING_IP_WHITELIST", "true").lower() == "true"
        self.enable_token_auth = os.getenv("ENABLE_MONITORING_TOKEN_AUTH", "true").lower() == "true"
        
    def _parse_allowed_ips(self) -> List[str]:
        """Parse allowed IP addresses/networks from environment."""
        allowed_ips_str = os.getenv("MONITORING_ALLOWED_IPS", "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
        return [ip.strip() for ip in allowed_ips_str.split(",") if ip.strip()]
    
    def is_ip_allowed(self, client_ip: str) -> bool:
        """Check if client IP is allowed to access monitoring endpoints."""
        if not self.enable_ip_whitelist:
            return True
            
        try:
            client_addr = ip_address(client_ip)
            
            for allowed_ip in self.allowed_ips:
                try:
                    # Check if it's a network range
                    if "/" in allowed_ip:
                        if client_addr in ip_network(allowed_ip, strict=False):
                            return True
                    else:
                        # Check if it's a single IP
                        if client_addr == ip_address(allowed_ip):
                            return True
                except ValueError:
                    logger.warning(f"Invalid IP/network in allowed list: {allowed_ip}")
                    continue
                    
            return False
            
        except ValueError:
            logger.warning(f"Invalid client IP address: {client_ip}")
            return False
    
    def is_token_valid(self, token: Optional[str]) -> bool:
        """Check if monitoring token is valid."""
        if not self.enable_token_auth:
            return True
            
        if not self.monitoring_token:
            logger.warning("Monitoring token not configured but token auth is enabled")
            return False
            
        return token == self.monitoring_token


# Global security config instance
monitoring_security = MonitoringSecurityConfig()


def get_client_ip(request: Request) -> str:
    """Extract client IP from request headers."""
    # Check for forwarded headers (common in load balancers/proxies)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    
    cf_connecting_ip = request.headers.get("cf-connecting-ip")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()
    
    if request.client:
        return request.client.host
    
    return "unknown"


def check_monitoring_access(request: Request) -> None:
    """Check if request is authorized to access monitoring endpoints."""
    client_ip = get_client_ip(request)
    
    # Check IP whitelist
    if not monitoring_security.is_ip_allowed(client_ip):
        logger.warning(f"Monitoring access denied for IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: IP not in whitelist"
        )
    
    # Check monitoring token
    auth_header = request.headers.get("authorization")
    token = None
    
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    elif auth_header and auth_header.startswith("Token "):
        token = auth_header[6:]
    
    # Also check query parameter for convenience (less secure)
    if not token:
        token = request.query_params.get("token")
    
    if not monitoring_security.is_token_valid(token):
        logger.warning(f"Invalid monitoring token from IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing monitoring token"
        )
    
    logger.info(f"Monitoring access granted for IP: {client_ip}")


def check_basic_health_access(request: Request) -> None:
    """Check access for basic health endpoints (more permissive)."""
    # Basic health endpoints are accessible from:
    # 1. Local/internal networks
    # 2. Load balancers
    # 3. Kubernetes health checks
    
    client_ip = get_client_ip(request)
    
    # Allow local and private networks
    allowed_networks = [
        "127.0.0.0/8",    # Localhost
        "::1/128",        # IPv6 localhost
        "10.0.0.0/8",     # Private network
        "172.16.0.0/12",  # Private network
        "192.168.0.0/16", # Private network
    ]
    
    try:
        client_addr = ip_address(client_ip)
        
        for network in allowed_networks:
            if client_addr in ip_network(network, strict=False):
                return
        
        # If not in private networks, check if it's explicitly allowed
        if monitoring_security.is_ip_allowed(client_ip):
            return
            
        # For production, you might want to be more restrictive
        # For now, we'll log and allow (can be configured via environment)
        if os.getenv("STRICT_HEALTH_CHECK_ACCESS", "false").lower() == "true":
            logger.warning(f"Health check access denied for IP: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        else:
            logger.info(f"Health check access allowed for IP: {client_ip}")
            
    except ValueError:
        logger.warning(f"Invalid client IP for health check: {client_ip}")
        if os.getenv("STRICT_HEALTH_CHECK_ACCESS", "false").lower() == "true":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )