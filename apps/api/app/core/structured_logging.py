"""
Structured logging system with request IDs and performance monitoring.
"""

import json
import logging
import time
import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from contextvars import ContextVar
from functools import wraps

# Context variable to store request ID across async calls
request_id_context: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs with request IDs.
    """
    
    def __init__(self, service_name: str = "grateful-api"):
        super().__init__()
        self.service_name = service_name
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        
        # Base log structure
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "service": self.service_name,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add request ID if available
        request_id = request_id_context.get()
        if request_id:
            log_entry["request_id"] = request_id
        
        # Add extra fields from log record
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                'filename', 'module', 'lineno', 'funcName', 'created', 
                'msecs', 'relativeCreated', 'thread', 'threadName', 
                'processName', 'process', 'getMessage', 'exc_info', 
                'exc_text', 'stack_info'
            }:
                extra_fields[key] = value
        
        if extra_fields:
            log_entry["extra"] = extra_fields
        
        # Add exception information if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info) if record.exc_info else None
            }
        
        # Add source location
        log_entry["source"] = {
            "file": record.filename,
            "line": record.lineno,
            "function": record.funcName
        }
        
        return json.dumps(log_entry, default=str, ensure_ascii=False)


class RequestLogger:
    """
    Logger for HTTP requests with performance tracking.
    """
    
    def __init__(self, logger_name: str = "grateful-api.requests"):
        self.logger = logging.getLogger(logger_name)
    
    def log_request_start(
        self, 
        method: str, 
        path: str, 
        request_id: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> None:
        """Log the start of an HTTP request."""
        self.logger.info(
            f"Request started: {method} {path}",
            extra={
                "event_type": "request_start",
                "method": method,
                "path": path,
                "request_id": request_id,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "user_id": user_id
            }
        )
    
    def log_request_end(
        self,
        method: str,
        path: str,
        request_id: str,
        status_code: int,
        response_time_ms: float,
        user_id: Optional[int] = None,
        error: Optional[str] = None
    ) -> None:
        """Log the end of an HTTP request."""
        level = logging.INFO
        message = f"Request completed: {method} {path} - {status_code}"
        
        # Determine log level based on status code and response time
        if status_code >= 500:
            level = logging.ERROR
            message = f"Request failed: {method} {path} - {status_code}"
        elif status_code >= 400:
            level = logging.WARNING
            message = f"Request error: {method} {path} - {status_code}"
        elif response_time_ms > 1000:  # Slow request
            level = logging.WARNING
            message = f"Slow request: {method} {path} - {status_code} ({response_time_ms:.1f}ms)"
        
        self.logger.log(
            level,
            message,
            extra={
                "event_type": "request_end",
                "method": method,
                "path": path,
                "request_id": request_id,
                "status_code": status_code,
                "response_time_ms": response_time_ms,
                "user_id": user_id,
                "error": error
            }
        )


class SecurityLogger:
    """
    Logger for security events and audit trails.
    """
    
    def __init__(self, logger_name: str = "grateful-api.security"):
        self.logger = logging.getLogger(logger_name)
    
    def log_authentication_success(
        self, 
        user_id: int, 
        username: str,
        request_id: Optional[str] = None,
        client_ip: Optional[str] = None
    ) -> None:
        """Log successful authentication."""
        self.logger.info(
            f"Authentication successful for user {username}",
            extra={
                "event_type": "authentication_success",
                "user_id": user_id,
                "username": username,
                "request_id": request_id,
                "client_ip": client_ip
            }
        )
    
    def log_authentication_failure(
        self,
        username: str,
        reason: str,
        request_id: Optional[str] = None,
        client_ip: Optional[str] = None
    ) -> None:
        """Log failed authentication attempt."""
        self.logger.warning(
            f"Authentication failed for user {username}: {reason}",
            extra={
                "event_type": "authentication_failure",
                "username": username,
                "reason": reason,
                "request_id": request_id,
                "client_ip": client_ip
            }
        )
    
    def log_rate_limit_exceeded(
        self,
        endpoint: str,
        limit: int,
        client_ip: Optional[str] = None,
        user_id: Optional[int] = None,
        request_id: Optional[str] = None
    ) -> None:
        """Log rate limit violation."""
        self.logger.warning(
            f"Rate limit exceeded for {endpoint}: {limit} requests/minute",
            extra={
                "event_type": "rate_limit_exceeded",
                "endpoint": endpoint,
                "limit": limit,
                "client_ip": client_ip,
                "user_id": user_id,
                "request_id": request_id
            }
        )
    
    def log_suspicious_activity(
        self,
        activity_type: str,
        description: str,
        client_ip: Optional[str] = None,
        user_id: Optional[int] = None,
        request_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log suspicious activity."""
        self.logger.error(
            f"Suspicious activity detected: {activity_type} - {description}",
            extra={
                "event_type": "suspicious_activity",
                "activity_type": activity_type,
                "description": description,
                "client_ip": client_ip,
                "user_id": user_id,
                "request_id": request_id,
                "additional_data": additional_data or {}
            }
        )


class PerformanceLogger:
    """
    Logger for performance monitoring and slow operations.
    """
    
    def __init__(self, logger_name: str = "grateful-api.performance"):
        self.logger = logging.getLogger(logger_name)
    
    def log_slow_operation(
        self,
        operation_name: str,
        duration_ms: float,
        threshold_ms: float = 300,
        request_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log slow operation."""
        self.logger.warning(
            f"Slow operation: {operation_name} took {duration_ms:.1f}ms (threshold: {threshold_ms}ms)",
            extra={
                "event_type": "slow_operation",
                "operation_name": operation_name,
                "duration_ms": duration_ms,
                "threshold_ms": threshold_ms,
                "request_id": request_id,
                "additional_data": additional_data or {}
            }
        )
    
    def log_database_slow_query(
        self,
        query_name: str,
        duration_ms: float,
        query_sql: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> None:
        """Log slow database query."""
        self.logger.warning(
            f"Slow database query: {query_name} took {duration_ms:.1f}ms",
            extra={
                "event_type": "slow_database_query",
                "query_name": query_name,
                "duration_ms": duration_ms,
                "query_sql": query_sql,
                "request_id": request_id
            }
        )
    
    def log_algorithm_performance(
        self,
        operation_name: str,
        duration_ms: float,
        target_ms: float = 300,
        cache_hit: bool = False,
        request_id: Optional[str] = None
    ) -> None:
        """Log algorithm performance metrics."""
        level = logging.INFO
        if duration_ms > target_ms:
            level = logging.WARNING
        
        self.logger.log(
            level,
            f"Algorithm operation: {operation_name} completed in {duration_ms:.1f}ms",
            extra={
                "event_type": "algorithm_performance",
                "operation_name": operation_name,
                "duration_ms": duration_ms,
                "target_ms": target_ms,
                "cache_hit": cache_hit,
                "request_id": request_id,
                "performance_ratio": duration_ms / target_ms
            }
        )


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return f"req-{uuid.uuid4().hex[:12]}"


def set_request_id(request_id: str) -> None:
    """Set the request ID in the context."""
    request_id_context.set(request_id)


def get_request_id() -> Optional[str]:
    """Get the current request ID from context."""
    return request_id_context.get()


def log_with_request_id(logger: logging.Logger, level: int, message: str, **kwargs) -> None:
    """Log a message with the current request ID."""
    request_id = get_request_id()
    extra = kwargs.get('extra', {})
    if request_id:
        extra['request_id'] = request_id
    kwargs['extra'] = extra
    logger.log(level, message, **kwargs)


def performance_monitor(operation_name: str, threshold_ms: float = 300):
    """
    Decorator to monitor operation performance and log slow operations.
    
    Args:
        operation_name: Name of the operation being monitored
        threshold_ms: Threshold in milliseconds for slow operation logging
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            request_id = get_request_id()
            
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                
                # Log performance
                perf_logger = PerformanceLogger()
                if duration_ms > threshold_ms:
                    perf_logger.log_slow_operation(
                        operation_name, 
                        duration_ms, 
                        threshold_ms, 
                        request_id
                    )
                else:
                    perf_logger.logger.debug(
                        f"Operation completed: {operation_name} in {duration_ms:.1f}ms",
                        extra={
                            "event_type": "operation_completed",
                            "operation_name": operation_name,
                            "duration_ms": duration_ms,
                            "request_id": request_id
                        }
                    )
                
                return result
                
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                perf_logger = PerformanceLogger()
                perf_logger.logger.error(
                    f"Operation failed: {operation_name} after {duration_ms:.1f}ms - {str(e)}",
                    extra={
                        "event_type": "operation_failed",
                        "operation_name": operation_name,
                        "duration_ms": duration_ms,
                        "error": str(e),
                        "request_id": request_id
                    },
                    exc_info=True
                )
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            request_id = get_request_id()
            
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                
                # Log performance
                perf_logger = PerformanceLogger()
                if duration_ms > threshold_ms:
                    perf_logger.log_slow_operation(
                        operation_name, 
                        duration_ms, 
                        threshold_ms, 
                        request_id
                    )
                
                return result
                
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                perf_logger = PerformanceLogger()
                perf_logger.logger.error(
                    f"Operation failed: {operation_name} after {duration_ms:.1f}ms - {str(e)}",
                    extra={
                        "event_type": "operation_failed",
                        "operation_name": operation_name,
                        "duration_ms": duration_ms,
                        "error": str(e),
                        "request_id": request_id
                    },
                    exc_info=True
                )
                raise
        
        return async_wrapper if hasattr(func, '__code__') and func.__code__.co_flags & 0x80 else sync_wrapper
    
    return decorator


def setup_structured_logging(
    service_name: str = "grateful-api",
    log_level: str = "INFO",
    enable_json_format: bool = True
) -> None:
    """
    Set up structured logging for the application.
    
    Args:
        service_name: Name of the service for log entries
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_json_format: Whether to use JSON formatting
    """
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler()
    
    if enable_json_format:
        # Use structured JSON formatter
        formatter = StructuredFormatter(service_name)
    else:
        # Use standard formatter for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    
    # Reduce verbosity for production-like environments
    if log_level.upper() in ["INFO", "WARNING", "ERROR"]:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("asyncio").setLevel(logging.WARNING)
        logging.getLogger("fastapi").setLevel(logging.INFO)
    
    # Create specialized loggers
    request_logger = logging.getLogger("grateful-api.requests")
    security_logger = logging.getLogger("grateful-api.security")
    performance_logger = logging.getLogger("grateful-api.performance")
    
    # Ensure they use the same handler
    for logger in [request_logger, security_logger, performance_logger]:
        logger.setLevel(getattr(logging, log_level.upper()))
        logger.propagate = True  # Let them propagate to root logger


# Global logger instances
request_logger = RequestLogger()
performance_logger = PerformanceLogger()