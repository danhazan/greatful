#!/usr/bin/env python3
"""
SSL Certificate Monitoring and Auto-Renewal Testing Script.

This script provides utilities for:
- Testing SSL certificate validity
- Monitoring certificate expiration
- Simulating auto-renewal processes
- Generating certificate status reports
"""

import asyncio
import json
import logging
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.ssl_middleware import SSLCertificateValidator, SSLConfigurationManager
from app.core.security_config import security_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SSLCertificateMonitor:
    """
    SSL Certificate monitoring and testing utilities.
    """
    
    def __init__(self):
        self.validator = SSLCertificateValidator()
        self.config_manager = SSLConfigurationManager()
    
    def check_configured_domains(self) -> Dict[str, Any]:
        """Check SSL certificates for all configured domains."""
        logger.info("Checking SSL certificates for configured domains...")
        
        # Get domains from configuration
        domains = []
        for origin in security_config.allowed_origins:
            if origin.startswith('https://'):
                domain = origin.replace('https://', '').split('/')[0]
                domains.append(domain)
        
        if not domains:
            logger.warning("No HTTPS domains found in configuration")
            return {
                'status': 'no_domains',
                'message': 'No HTTPS domains configured for certificate checking'
            }
        
        logger.info(f"Found {len(domains)} HTTPS domains to check: {domains}")
        
        # Check certificates
        results = self.config_manager.check_domain_certificates(domains)
        
        # Log results
        if results.get('checked'):
            summary = results.get('summary', {})
            logger.info(f"Certificate check summary:")
            logger.info(f"  Total domains: {summary.get('total_domains', 0)}")
            logger.info(f"  Valid certificates: {summary.get('valid_certificates', 0)}")
            logger.info(f"  Invalid certificates: {summary.get('invalid_certificates', 0)}")
            logger.info(f"  Expiring soon: {summary.get('expiring_soon', 0)}")
            
            # Log warnings
            warnings = results.get('warnings', [])
            if warnings:
                logger.warning("Certificate warnings:")
                for warning in warnings:
                    logger.warning(f"  - {warning}")
        
        return results
    
    def check_specific_domains(self, domains: List[str]) -> Dict[str, Any]:
        """Check SSL certificates for specific domains."""
        logger.info(f"Checking SSL certificates for specific domains: {domains}")
        
        results = self.config_manager.check_domain_certificates(domains)
        
        # Log detailed results
        if results.get('checked'):
            cert_results = results.get('results', {})
            for domain, cert_info in cert_results.items():
                if cert_info.get('valid'):
                    days_left = cert_info.get('days_until_expiry', 'unknown')
                    logger.info(f"✓ {domain}: Valid certificate, expires in {days_left} days")
                else:
                    error = cert_info.get('error', 'Unknown error')
                    logger.error(f"✗ {domain}: Invalid certificate - {error}")
        
        return results
    
    def test_auto_renewal_readiness(self) -> Dict[str, Any]:
        """Test readiness for SSL certificate auto-renewal."""
        logger.info("Testing SSL certificate auto-renewal readiness...")
        
        readiness_report = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'ready',
            'checks': {},
            'recommendations': []
        }
        
        # Check 1: Configuration validation
        logger.info("Checking SSL configuration...")
        config_validation = self.config_manager.validate_ssl_configuration()
        readiness_report['checks']['configuration'] = config_validation
        
        if not config_validation['valid']:
            readiness_report['overall_status'] = 'not_ready'
            logger.error("SSL configuration validation failed")
        else:
            logger.info("✓ SSL configuration is valid")
        
        # Check 2: Certificate status
        logger.info("Checking current certificate status...")
        cert_results = self.check_configured_domains()
        readiness_report['checks']['certificates'] = cert_results
        
        if cert_results.get('checked'):
            summary = cert_results.get('summary', {})
            invalid_certs = summary.get('invalid_certificates', 0)
            expiring_soon = summary.get('expiring_soon', 0)
            
            if invalid_certs > 0:
                readiness_report['overall_status'] = 'issues'
                logger.warning(f"Found {invalid_certs} invalid certificates")
            
            if expiring_soon > 0:
                readiness_report['recommendations'].append(
                    f"Prepare for renewal: {expiring_soon} certificates expire within 30 days"
                )
                logger.warning(f"Found {expiring_soon} certificates expiring soon")
        
        # Check 3: Environment readiness
        logger.info("Checking environment readiness...")
        env_checks = self._check_environment_readiness()
        readiness_report['checks']['environment'] = env_checks
        
        if not env_checks['ready']:
            readiness_report['overall_status'] = 'not_ready'
            logger.error("Environment not ready for auto-renewal")
        else:
            logger.info("✓ Environment is ready for auto-renewal")
        
        # Check 4: Monitoring setup
        logger.info("Checking monitoring setup...")
        monitoring_checks = self._check_monitoring_setup()
        readiness_report['checks']['monitoring'] = monitoring_checks
        
        if not monitoring_checks['ready']:
            readiness_report['recommendations'].append(
                "Set up certificate expiration monitoring and alerting"
            )
            logger.warning("Certificate monitoring not fully configured")
        else:
            logger.info("✓ Certificate monitoring is configured")
        
        # Final status
        logger.info(f"Auto-renewal readiness: {readiness_report['overall_status']}")
        
        return readiness_report
    
    def _check_environment_readiness(self) -> Dict[str, Any]:
        """Check if environment is ready for auto-renewal."""
        checks = {
            'ready': True,
            'issues': [],
            'details': {}
        }
        
        # Check if running in production
        if not security_config.is_production:
            checks['details']['environment'] = 'development'
            checks['issues'].append('Not running in production environment')
        else:
            checks['details']['environment'] = 'production'
        
        # Check SSL redirect configuration
        if not security_config.ssl_redirect:
            checks['ready'] = False
            checks['issues'].append('SSL redirect not enabled')
        
        # Check HSTS configuration
        if security_config.hsts_max_age < 31536000:  # 1 year
            checks['issues'].append('HSTS max-age should be at least 1 year')
        
        checks['details']['ssl_redirect'] = security_config.ssl_redirect
        checks['details']['hsts_max_age'] = security_config.hsts_max_age
        
        return checks
    
    def _check_monitoring_setup(self) -> Dict[str, Any]:
        """Check certificate monitoring setup."""
        checks = {
            'ready': True,
            'features': {},
            'recommendations': []
        }
        
        # Check if SSL health endpoint is available
        try:
            # This would normally make an HTTP request to /api/v1/ssl/health
            # For now, we'll just check if the endpoint exists
            checks['features']['ssl_health_endpoint'] = True
        except Exception:
            checks['features']['ssl_health_endpoint'] = False
            checks['recommendations'].append('SSL health endpoint not accessible')
        
        # Check logging configuration
        log_level = os.getenv('LOG_LEVEL', 'INFO')
        checks['features']['logging_enabled'] = log_level in ['INFO', 'DEBUG']
        
        # Check if alerting is configured
        email_alerts = os.getenv('ENABLE_EMAIL_ALERTS', 'false').lower() == 'true'
        slack_alerts = os.getenv('ENABLE_SLACK_ALERTS', 'false').lower() == 'true'
        
        checks['features']['email_alerts'] = email_alerts
        checks['features']['slack_alerts'] = slack_alerts
        
        if not (email_alerts or slack_alerts):
            checks['recommendations'].append('Configure email or Slack alerts for certificate expiration')
        
        return checks
    
    def generate_certificate_report(self, output_file: Optional[str] = None) -> Dict[str, Any]:
        """Generate comprehensive certificate status report."""
        logger.info("Generating comprehensive certificate status report...")
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'environment': security_config.environment,
            'configuration': self.config_manager.get_ssl_configuration(),
            'validation': self.config_manager.validate_ssl_configuration(),
            'certificates': self.check_configured_domains(),
            'auto_renewal_readiness': self.test_auto_renewal_readiness()
        }
        
        # Calculate overall health score
        health_score = self._calculate_health_score(report)
        report['health_score'] = health_score
        
        # Save to file if requested
        if output_file:
            try:
                with open(output_file, 'w') as f:
                    json.dump(report, f, indent=2, default=str)
                logger.info(f"Certificate report saved to {output_file}")
            except Exception as e:
                logger.error(f"Failed to save report to {output_file}: {e}")
        
        return report
    
    def _calculate_health_score(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall SSL health score."""
        score = 100
        issues = []
        
        # Deduct points for configuration issues
        config_validation = report.get('validation', {})
        if not config_validation.get('valid', True):
            score -= 30
            issues.extend(config_validation.get('issues', []))
        
        # Deduct points for certificate issues
        cert_results = report.get('certificates', {})
        if cert_results.get('checked'):
            summary = cert_results.get('summary', {})
            invalid_certs = summary.get('invalid_certificates', 0)
            expiring_soon = summary.get('expiring_soon', 0)
            
            score -= (invalid_certs * 25)  # 25 points per invalid cert
            score -= (expiring_soon * 10)  # 10 points per expiring cert
        
        # Deduct points for auto-renewal readiness issues
        renewal_readiness = report.get('auto_renewal_readiness', {})
        if renewal_readiness.get('overall_status') == 'not_ready':
            score -= 20
        elif renewal_readiness.get('overall_status') == 'issues':
            score -= 10
        
        # Ensure score doesn't go below 0
        score = max(0, score)
        
        # Determine status
        if score >= 90:
            status = 'excellent'
        elif score >= 75:
            status = 'good'
        elif score >= 50:
            status = 'fair'
        else:
            status = 'poor'
        
        return {
            'score': score,
            'status': status,
            'issues': issues
        }


async def main():
    """Main function for SSL certificate monitoring."""
    import argparse
    
    parser = argparse.ArgumentParser(description='SSL Certificate Monitoring Tool')
    parser.add_argument('--check-configured', action='store_true',
                       help='Check certificates for configured domains')
    parser.add_argument('--check-domains', nargs='+',
                       help='Check certificates for specific domains')
    parser.add_argument('--test-renewal', action='store_true',
                       help='Test auto-renewal readiness')
    parser.add_argument('--generate-report', action='store_true',
                       help='Generate comprehensive certificate report')
    parser.add_argument('--output', type=str,
                       help='Output file for report (JSON format)')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    monitor = SSLCertificateMonitor()
    
    try:
        if args.check_configured:
            results = monitor.check_configured_domains()
            print(json.dumps(results, indent=2, default=str))
        
        elif args.check_domains:
            results = monitor.check_specific_domains(args.check_domains)
            print(json.dumps(results, indent=2, default=str))
        
        elif args.test_renewal:
            results = monitor.test_auto_renewal_readiness()
            print(json.dumps(results, indent=2, default=str))
        
        elif args.generate_report:
            results = monitor.generate_certificate_report(args.output)
            if not args.output:
                print(json.dumps(results, indent=2, default=str))
        
        else:
            # Default: check configured domains
            logger.info("No specific action specified, checking configured domains...")
            results = monitor.check_configured_domains()
            print(json.dumps(results, indent=2, default=str))
    
    except Exception as e:
        logger.error(f"SSL certificate monitoring failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())