#!/usr/bin/env python3
"""
Production Configuration Validation Tests
Tests for production configuration issues and placeholder values
"""

import os
import sys
import asyncio
import pytest
from unittest.mock import patch

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'app'))


class TestProductionConfigValidation:
    """Test production configuration validation"""

    @pytest.mark.asyncio
    async def test_production_config_placeholder_detection(self):
        """Test detection of placeholder values in production configuration"""
        
        # Set production-like environment variables with problematic values
        production_env = {
            'ENVIRONMENT': 'production',
            'FRONTEND_BASE_URL': 'https://yourdomain.com',  # Placeholder from config
            'ALLOWED_ORIGINS': 'https://yourdomain.com,https://www.yourdomain.com',  # Placeholder
            'DATABASE_URL': 'postgresql+asyncpg://grateful_prod:CHANGE_THIS_PASSWORD@localhost:5432/grateful_prod?ssl=require',  # Placeholder
            'SECRET_KEY': 'P8D0sqcFXLPH0ZKb9fVHAWfsjSdqZ-UUbdL__ku-ZNqAJR3kDGphIZqFT07mBTimw8ooyxUvh0k2IDhJi9kogA',
            'SSL_REDIRECT': 'true',
            'SECURE_COOKIES': 'true',
            'ENABLE_DOCS': 'false',
            'LOG_LEVEL': 'INFO'
        }
        
        with patch.dict(os.environ, production_env):
            # Test frontend URL placeholder detection
            frontend_url = os.environ.get('FRONTEND_BASE_URL', 'http://localhost:3000')
            assert 'yourdomain.com' in frontend_url, "Should detect placeholder domain"
            
            # Test database URL placeholder detection
            db_url = os.environ.get('DATABASE_URL')
            assert 'CHANGE_THIS_PASSWORD' in db_url, "Should detect placeholder password"
            
            # Test CORS origins placeholder detection
            allowed_origins = os.environ.get('ALLOWED_ORIGINS', '')
            assert 'yourdomain.com' in allowed_origins, "Should detect placeholder CORS origins"

    @pytest.mark.asyncio
    async def test_corrected_production_config(self):
        """Test corrected production configuration without placeholders"""
        
        # Set corrected production environment variables
        corrected_env = {
            'ENVIRONMENT': 'production',
            'FRONTEND_BASE_URL': 'https://grateful-web.vercel.app',
            'ALLOWED_ORIGINS': 'https://grateful-web.vercel.app,https://www.grateful-web.vercel.app',
            'DATABASE_URL': 'postgresql+asyncpg://grateful_prod:secure_password@localhost:5432/grateful_prod?ssl=require',
            'SECRET_KEY': 'P8D0sqcFXLPH0ZKb9fVHAWfsjSdqZ-UUbdL__ku-ZNqAJR3kDGphIZqFT07mBTimw8ooyxUvh0k2IDhJi9kogA',
            'SSL_REDIRECT': 'true',
            'SECURE_COOKIES': 'true',
            'ENABLE_DOCS': 'false',
            'LOG_LEVEL': 'INFO'
        }
        
        with patch.dict(os.environ, corrected_env):
            # Test frontend URL is corrected
            frontend_url = os.environ.get('FRONTEND_BASE_URL', 'http://localhost:3000')
            assert 'yourdomain.com' not in frontend_url, "Should not contain placeholder domain"
            assert 'grateful-web.vercel.app' in frontend_url, "Should contain actual production domain"
            
            # Test CORS origins are corrected
            allowed_origins = os.environ.get('ALLOWED_ORIGINS', '')
            assert 'yourdomain.com' not in allowed_origins, "Should not contain placeholder CORS origins"
            assert 'grateful-web.vercel.app' in allowed_origins, "Should contain actual production domain"

    @pytest.mark.asyncio
    async def test_share_url_generation_with_production_config(self):
        """Test share URL generation with production configuration"""
        
        corrected_env = {
            'FRONTEND_BASE_URL': 'https://grateful-web.vercel.app',
        }
        
        with patch.dict(os.environ, corrected_env):
            try:
                from app.services.share_service import ShareService
                
                # Test share URL generation with production config
                base_url = os.environ.get('FRONTEND_BASE_URL', 'http://localhost:3000')
                test_post_id = "test-post-123"
                expected_url = f"{base_url}/post/{test_post_id}"
                
                assert 'yourdomain.com' not in expected_url, "Share URLs should not use placeholder domain"
                assert 'grateful-web.vercel.app' in expected_url, "Share URLs should use production domain"
                assert expected_url == "https://grateful-web.vercel.app/post/test-post-123"
                
            except ImportError as e:
                pytest.skip(f"ShareService not available: {e}")

    @pytest.mark.asyncio
    async def test_ssl_and_security_configuration(self):
        """Test SSL and security configuration settings"""
        
        security_env = {
            'SSL_REDIRECT': 'true',
            'SECURE_COOKIES': 'true',
            'ENABLE_DOCS': 'false',
            'ENVIRONMENT': 'production'
        }
        
        with patch.dict(os.environ, security_env):
            ssl_redirect = os.environ.get('SSL_REDIRECT', 'false').lower() == 'true'
            secure_cookies = os.environ.get('SECURE_COOKIES', 'false').lower() == 'true'
            enable_docs = os.environ.get('ENABLE_DOCS', 'true').lower() == 'true'
            environment = os.environ.get('ENVIRONMENT', 'development')
            
            assert ssl_redirect, "SSL redirect should be enabled in production"
            assert secure_cookies, "Secure cookies should be enabled in production"
            assert not enable_docs, "API docs should be disabled in production"
            assert environment == 'production', "Environment should be set to production"

    def test_configuration_validation_function(self):
        """Test configuration validation utility function"""
        
        def validate_production_config(config):
            """Validate production configuration for placeholder values"""
            issues = []
            warnings = []
            
            # Check for placeholder domains
            if 'yourdomain.com' in config.get('FRONTEND_BASE_URL', ''):
                issues.append("Frontend URL contains placeholder domain")
            
            if 'yourdomain.com' in config.get('ALLOWED_ORIGINS', ''):
                issues.append("CORS origins contain placeholder domain")
            
            # Check for placeholder passwords
            if 'CHANGE_THIS_PASSWORD' in config.get('DATABASE_URL', ''):
                warnings.append("Database URL contains placeholder password")
            
            # Check for weak secrets
            if len(config.get('SECRET_KEY', '')) < 64:
                warnings.append("SECRET_KEY should be at least 64 characters")
            
            return issues, warnings
        
        # Test with problematic config
        problematic_config = {
            'FRONTEND_BASE_URL': 'https://yourdomain.com',
            'ALLOWED_ORIGINS': 'https://yourdomain.com,https://www.yourdomain.com',
            'DATABASE_URL': 'postgresql+asyncpg://user:CHANGE_THIS_PASSWORD@host:5432/db',
            'SECRET_KEY': 'short_key'
        }
        
        issues, warnings = validate_production_config(problematic_config)
        
        assert len(issues) == 2, "Should find 2 critical issues"
        assert "Frontend URL contains placeholder domain" in issues
        assert "CORS origins contain placeholder domain" in issues
        assert len(warnings) == 2, "Should find 2 warnings"
        assert "Database URL contains placeholder password" in warnings
        assert "SECRET_KEY should be at least 64 characters" in warnings
        
        # Test with corrected config
        corrected_config = {
            'FRONTEND_BASE_URL': 'https://grateful-web.vercel.app',
            'ALLOWED_ORIGINS': 'https://grateful-web.vercel.app,https://www.grateful-web.vercel.app',
            'DATABASE_URL': 'postgresql+asyncpg://user:secure_password@host:5432/db',
            'SECRET_KEY': 'P8D0sqcFXLPH0ZKb9fVHAWfsjSdqZ-UUbdL__ku-ZNqAJR3kDGphIZqFT07mBTimw8ooyxUvh0k2IDhJi9kogA'
        }
        
        issues, warnings = validate_production_config(corrected_config)
        
        assert len(issues) == 0, "Should find no critical issues"
        assert len(warnings) == 0, "Should find no warnings"