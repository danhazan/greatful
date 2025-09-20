"""
Test authentication utilities for load testing.
"""

import os
import sys
from typing import Optional
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


def get_test_user_id_from_token(credentials: HTTPAuthorizationCredentials) -> Optional[int]:
    """
    Extract user ID from test token during load testing.
    
    Test tokens have format: "test_token_{user_id}"
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Debug logging
    logger.info(f"Test auth check - TESTING: {os.getenv('TESTING')}, LOAD_TESTING: {os.getenv('LOAD_TESTING')}, PYTEST_CURRENT_TEST: {os.getenv('PYTEST_CURRENT_TEST')}")
    
    if not (os.getenv('TESTING') == 'true' or 
            os.getenv('LOAD_TESTING') == 'true' or
            os.getenv('PYTEST_CURRENT_TEST')):
        logger.info("Test environment not detected")
        return None
    
    token = credentials.credentials
    logger.info(f"Checking token: {token[:20]}...")
    
    if token.startswith("test_token_"):
        try:
            user_id = int(token.replace("test_token_", ""))
            logger.info(f"Test token detected, user_id: {user_id}")
            return user_id
        except ValueError:
            logger.warning(f"Invalid test token format: {token}")
            pass
    
    logger.info("Not a test token")
    return None


def is_test_environment() -> bool:
    """Check if we're in a test environment."""
    # Don't bypass security for security tests
    if os.getenv('SECURITY_TESTING') == 'true':
        return False
        
    return (os.getenv('TESTING') == 'true' or 
            os.getenv('LOAD_TESTING') == 'true' or
            os.getenv('PYTEST_CURRENT_TEST') is not None or
            'pytest' in os.environ.get('_', '') or
            any('pytest' in str(arg) for arg in sys.argv))