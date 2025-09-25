#!/usr/bin/env python3
"""
HTTPS Security Validation Script

This script validates HTTPS security configurations including:
- SSL certificate validity
- HTTPS enforcement
- HSTS headers
- Security headers
- Certificate chain validation

Usage:
    python scripts/validate_https_security.py [--domain DOMAIN] [--check-all]
    
Options:
    --domain DOMAIN    Specific domain to check (default: from ALLOWED_ORIGINS)
    --check-all        Check all domains from ALLOWED_ORIGINS
"""

import os
import sys
import ssl
import socket
import argparse
import requests
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import Dict, Any, List, Tuple, Optional
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security_config import SecurityConfig


class HTTPSSecurityValidator:
    """Validates HTTPS security configurations."""
    
    def __init__(self):
        self.results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "domains_checked": [],
            "ssl_certificates": {},
            "https_enforcement": {},
            "security_headers": {},
            "overall_status": "unknown",
            "recommendations": []
        }
    
    def print_header(self, title: str):
        """Print formatted header."""
        print("\n" + "=" * 60)
        print(f" {title}")
        print("=" * 60)
    
    def print_status(self, status: str, message: str, details: str = None):
        """Print status message with formatting."""
        symbols = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "INFO": "ℹ️"}
        symbol = symbols.get(status, "•")
        print(f"{symbol} {message}")
        if details:
            print(f"   {details}")
    
    def get_domains_from_config(self) -> List[str]:
        """Get domains from ALLOWED_ORIGINS configuration."""
        try:
            config = SecurityConfig()
            origins = config.allowed_origins
            
            domains = []
            for origin in origins:
                if origin.startswith("https://"):
                    parsed = urlparse(origin)
                    if parsed.hostname:
                        domains.append(parsed.hostname)
            
            return list(set(domains))  # Remove duplicates
            
        except Exception as e:
            self.print_status("WARN", f"Could not get domains from config: {e}")
            return []
    
    def check_ssl_certificate(self, domain: str, port: int = 443) -> Tuple[bool, Dict[str, Any]]:
        """Check SSL certificate for a domain."""
        result = {
            "domain": domain,
            "port": port,
            "valid": False,
            "details": {}
        }
        
        try:
            # Create SSL context
            context = ssl.create_default_context()
            
            # Connect and get certificate
            with socket.create_connection((domain, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=domain) as ssock:
                    cert = ssock.getpeercert()
                    
                    if cert:
                        # Parse certificate details
                        subject = dict(x[0] for x in cert['subject'])
                        issuer = dict(x[0] for x in cert['issuer'])
                        
                        # Check expiration
                        not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                        not_before = datetime.strptime(cert['notBefore'], '%b %d %H:%M:%S %Y %Z')
                        now = datetime.now()
                        
                        days_until_expiry = (not_after - now).days
                        
                        result["details"] = {
                            "subject_cn": subject.get('commonName', 'N/A'),
                            "issuer_cn": issuer.get('commonName', 'N/A'),
                            "issuer_org": issuer.get('organizationName', 'N/A'),
                            "not_before": not_before.isoformat(),
                            "not_after": not_after.isoformat(),
                            "days_until_expiry": days_until_expiry,
                            "serial_number": cert.get('serialNumber', 'N/A'),
                            "version": cert.get('version', 'N/A'),
                            "signature_algorithm": cert.get('signatureAlgorithm', 'N/A')
                        }
                        
                        # Check Subject Alternative Names
                        san_list = []
                        for ext in cert.get('subjectAltName', []):
                            if ext[0] == 'DNS':
                                san_list.append(ext[1])
                        result["details"]["subject_alt_names"] = san_list
                        
                        # Validate certificate
                        is_valid = (
                            now >= not_before and
                            now <= not_after and
                            days_until_expiry > 7  # At least 7 days before expiry
                        )
                        
                        result["valid"] = is_valid
                        
                        if days_until_expiry <= 30:
                            self.results["recommendations"].append(
                                f"SSL certificate for {domain} expires in {days_until_expiry} days - consider renewal"
                            )
                        
                        if days_until_expiry <= 7:
                            result["valid"] = False
                            self.results["recommendations"].append(
                                f"URGENT: SSL certificate for {domain} expires in {days_until_expiry} days"
                            )
                    
        except ssl.SSLError as e:
            result["details"]["ssl_error"] = str(e)
            self.results["recommendations"].append(f"SSL error for {domain}: {e}")
        except socket.timeout:
            result["details"]["error"] = "Connection timeout"
            self.results["recommendations"].append(f"Connection timeout for {domain} - check domain accessibility")
        except Exception as e:
            result["details"]["error"] = str(e)
            self.results["recommendations"].append(f"Certificate check failed for {domain}: {e}")
        
        return result["valid"], result
    
    def check_https_enforcement(self, domain: str) -> Tuple[bool, Dict[str, Any]]:
        """Check HTTPS enforcement for a domain."""
        result = {
            "domain": domain,
            "https_enforced": False,
            "details": {}
        }
        
        try:
            # Test HTTP to HTTPS redirect
            http_url = f"http://{domain}"
            
            response = requests.get(
                http_url, 
                allow_redirects=False, 
                timeout=10,
                headers={'User-Agent': 'HTTPS-Security-Validator/1.0'}
            )
            
            result["details"]["http_status_code"] = response.status_code
            result["details"]["http_headers"] = dict(response.headers)
            
            # Check for redirect to HTTPS
            if response.status_code in [301, 302, 307, 308]:
                location = response.headers.get('Location', '')
                result["details"]["redirect_location"] = location
                
                if location.startswith('https://'):
                    result["https_enforced"] = True
                    result["details"]["redirect_type"] = "HTTPS redirect"
                else:
                    result["details"]["redirect_type"] = "Non-HTTPS redirect"
                    self.results["recommendations"].append(
                        f"HTTP requests to {domain} should redirect to HTTPS, not {location}"
                    )
            else:
                result["details"]["redirect_type"] = "No redirect"
                self.results["recommendations"].append(
                    f"HTTP requests to {domain} should redirect to HTTPS (status: {response.status_code})"
                )
        
        except requests.exceptions.SSLError as e:
            result["details"]["ssl_error"] = str(e)
            # SSL error on HTTP request might indicate HTTPS-only server
            result["https_enforced"] = True
            result["details"]["redirect_type"] = "HTTPS-only server"
        except requests.exceptions.ConnectionError as e:
            result["details"]["connection_error"] = str(e)
            self.results["recommendations"].append(f"Could not connect to {domain}: {e}")
        except Exception as e:
            result["details"]["error"] = str(e)
            self.results["recommendations"].append(f"HTTPS enforcement check failed for {domain}: {e}")
        
        return result["https_enforced"], result
    
    def check_security_headers(self, domain: str) -> Tuple[bool, Dict[str, Any]]:
        """Check security headers for a domain."""
        result = {
            "domain": domain,
            "secure_headers": False,
            "details": {}
        }
        
        try:
            https_url = f"https://{domain}"
            
            response = requests.get(
                https_url, 
                timeout=10,
                headers={'User-Agent': 'HTTPS-Security-Validator/1.0'}
            )
            
            headers = response.headers
            result["details"]["status_code"] = response.status_code
            
            # Check essential security headers
            security_headers = {
                "Strict-Transport-Security": "HSTS header",
                "X-Content-Type-Options": "Content type options",
                "X-Frame-Options": "Frame options",
                "X-XSS-Protection": "XSS protection",
                "Content-Security-Policy": "Content Security Policy",
                "Referrer-Policy": "Referrer policy"
            }
            
            present_headers = {}
            missing_headers = []
            
            for header, description in security_headers.items():
                value = headers.get(header)
                if value:
                    present_headers[header] = value
                else:
                    missing_headers.append(header)
            
            result["details"]["present_headers"] = present_headers
            result["details"]["missing_headers"] = missing_headers
            
            # Validate HSTS header specifically
            hsts_header = headers.get("Strict-Transport-Security", "")
            if hsts_header:
                result["details"]["hsts_analysis"] = self.analyze_hsts_header(hsts_header)
            
            # Check for insecure headers
            insecure_headers = {
                "Server": "Server information disclosure",
                "X-Powered-By": "Technology stack disclosure"
            }
            
            disclosed_info = {}
            for header, description in insecure_headers.items():
                value = headers.get(header)
                if value:
                    disclosed_info[header] = value
                    self.results["recommendations"].append(
                        f"Consider removing {header} header from {domain} to avoid {description.lower()}"
                    )
            
            result["details"]["disclosed_info"] = disclosed_info
            
            # Overall security assessment
            critical_headers = ["Strict-Transport-Security", "X-Content-Type-Options"]
            has_critical = all(h in present_headers for h in critical_headers)
            
            result["secure_headers"] = (
                has_critical and
                len(missing_headers) <= 2  # Allow some flexibility
            )
            
            if not result["secure_headers"]:
                for header in missing_headers:
                    if header in critical_headers:
                        self.results["recommendations"].append(
                            f"Add {header} security header to {domain}"
                        )
        
        except Exception as e:
            result["details"]["error"] = str(e)
            self.results["recommendations"].append(f"Security headers check failed for {domain}: {e}")
        
        return result["secure_headers"], result
    
    def analyze_hsts_header(self, hsts_header: str) -> Dict[str, Any]:
        """Analyze HSTS header configuration."""
        analysis = {
            "raw_header": hsts_header,
            "max_age": 0,
            "include_subdomains": False,
            "preload": False,
            "valid": False
        }
        
        try:
            # Parse HSTS header
            parts = [part.strip() for part in hsts_header.split(';')]
            
            for part in parts:
                if part.startswith('max-age='):
                    analysis["max_age"] = int(part.split('=')[1])
                elif part == 'includeSubDomains':
                    analysis["include_subdomains"] = True
                elif part == 'preload':
                    analysis["preload"] = True
            
            # Validate HSTS configuration
            min_max_age = 31536000  # 1 year
            analysis["valid"] = (
                analysis["max_age"] >= min_max_age and
                analysis["include_subdomains"] and
                analysis["preload"]
            )
            
            if analysis["max_age"] < min_max_age:
                analysis["recommendations"] = f"Increase max-age to at least {min_max_age} (1 year)"
            if not analysis["include_subdomains"]:
                analysis["recommendations"] = "Add includeSubDomains directive"
            if not analysis["preload"]:
                analysis["recommendations"] = "Add preload directive for enhanced security"
        
        except Exception as e:
            analysis["error"] = str(e)
        
        return analysis
    
    def validate_domain(self, domain: str) -> Dict[str, Any]:
        """Validate HTTPS security for a single domain."""
        self.print_status("INFO", f"Validating HTTPS security for {domain}...")
        
        domain_result = {
            "domain": domain,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ssl_certificate": {},
            "https_enforcement": {},
            "security_headers": {},
            "overall_secure": False
        }
        
        # Check SSL certificate
        ssl_valid, ssl_result = self.check_ssl_certificate(domain)
        domain_result["ssl_certificate"] = ssl_result
        
        if ssl_valid:
            self.print_status("PASS", f"SSL certificate valid for {domain}")
        else:
            self.print_status("FAIL", f"SSL certificate issues for {domain}")
        
        # Check HTTPS enforcement
        https_enforced, https_result = self.check_https_enforcement(domain)
        domain_result["https_enforcement"] = https_result
        
        if https_enforced:
            self.print_status("PASS", f"HTTPS enforcement enabled for {domain}")
        else:
            self.print_status("FAIL", f"HTTPS enforcement not properly configured for {domain}")
        
        # Check security headers
        headers_secure, headers_result = self.check_security_headers(domain)
        domain_result["security_headers"] = headers_result
        
        if headers_secure:
            self.print_status("PASS", f"Security headers properly configured for {domain}")
        else:
            self.print_status("WARN", f"Security headers could be improved for {domain}")
        
        # Overall assessment
        domain_result["overall_secure"] = ssl_valid and https_enforced and headers_secure
        
        return domain_result
    
    def validate_all_domains(self, domains: List[str]) -> bool:
        """Validate HTTPS security for all domains."""
        self.print_header("HTTPS Security Validation")
        
        if not domains:
            self.print_status("WARN", "No domains to validate")
            return False
        
        all_secure = True
        
        for domain in domains:
            try:
                domain_result = self.validate_domain(domain)
                
                # Store results
                self.results["domains_checked"].append(domain)
                self.results["ssl_certificates"][domain] = domain_result["ssl_certificate"]
                self.results["https_enforcement"][domain] = domain_result["https_enforcement"]
                self.results["security_headers"][domain] = domain_result["security_headers"]
                
                if not domain_result["overall_secure"]:
                    all_secure = False
                    
            except Exception as e:
                self.print_status("FAIL", f"Validation failed for {domain}: {e}")
                all_secure = False
        
        # Set overall status
        if all_secure:
            self.results["overall_status"] = "SECURE"
        elif len([d for d in domains if self.results["ssl_certificates"].get(d, {}).get("valid", False)]) > 0:
            self.results["overall_status"] = "PARTIALLY_SECURE"
        else:
            self.results["overall_status"] = "INSECURE"
        
        return all_secure
    
    def print_summary(self):
        """Print validation summary."""
        self.print_header("HTTPS Security Summary")
        
        total_domains = len(self.results["domains_checked"])
        secure_ssl = sum(1 for cert in self.results["ssl_certificates"].values() if cert.get("valid", False))
        enforced_https = sum(1 for enf in self.results["https_enforcement"].values() if enf.get("https_enforced", False))
        secure_headers = sum(1 for hdr in self.results["security_headers"].values() if hdr.get("secure_headers", False))
        
        self.print_status("INFO", f"Domains Checked: {total_domains}")
        self.print_status("INFO", f"Valid SSL Certificates: {secure_ssl}/{total_domains}")
        self.print_status("INFO", f"HTTPS Enforcement: {enforced_https}/{total_domains}")
        self.print_status("INFO", f"Secure Headers: {secure_headers}/{total_domains}")
        self.print_status("INFO", f"Overall Status: {self.results['overall_status']}")
        
        if self.results["recommendations"]:
            print(f"\nRecommendations ({len(self.results['recommendations'])}):")
            for i, rec in enumerate(self.results["recommendations"], 1):
                print(f"  {i}. {rec}")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="HTTPS Security Validation")
    parser.add_argument(
        "--domain", 
        help="Specific domain to check"
    )
    parser.add_argument(
        "--check-all", 
        action="store_true", 
        help="Check all domains from ALLOWED_ORIGINS"
    )
    
    args = parser.parse_args()
    
    validator = HTTPSSecurityValidator()
    
    if args.domain:
        domains = [args.domain]
    elif args.check_all:
        domains = validator.get_domains_from_config()
        if not domains:
            print("No domains found in ALLOWED_ORIGINS configuration")
            sys.exit(1)
    else:
        # Default: check first domain from config
        domains = validator.get_domains_from_config()[:1]
        if not domains:
            print("No domains found in configuration. Use --domain to specify a domain.")
            sys.exit(1)
    
    success = validator.validate_all_domains(domains)
    validator.print_summary()
    
    # Save detailed report
    report_file = f"https_security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    import json
    with open(report_file, 'w') as f:
        json.dump(validator.results, f, indent=2)
    
    validator.print_status("INFO", f"Detailed report saved to: {report_file}")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()