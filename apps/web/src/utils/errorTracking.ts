/**
 * Frontend error tracking and reporting system for JavaScript errors and API failures.
 */

interface ErrorReport {
  id: string;
  timestamp: string;
  type: 'javascript' | 'api' | 'network' | 'component';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  metadata: Record<string, any>;
}

interface APIErrorDetails {
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  responseBody?: any;
  requestBody?: any;
  headers?: Record<string, string>;
}

interface ComponentErrorDetails {
  componentName: string;
  componentStack?: string;
  props?: Record<string, any>;
}

class ErrorTracker {
  private sessionId: string;
  private userId?: string;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;
  private reportingEndpoint = '/api/errors/report';
  private isEnabled = true;
  private rateLimitMap = new Map<string, number>();
  private rateLimitWindow = 60000; // 1 minute
  private maxErrorsPerWindow = 10;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
    this.setupUnhandledRejectionHandler();
    this.startPeriodicReporting();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private setupGlobalErrorHandlers(): void {
    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportJavaScriptError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportJavaScriptError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        filename: window.location.href,
        lineno: 0,
        colno: 0,
        error: event.reason
      });
    });
  }

  private setupUnhandledRejectionHandler(): void {
    // Additional promise rejection handling
    if (typeof process !== 'undefined' && process.on) {
      process.on('unhandledRejection', (reason) => {
        this.reportJavaScriptError({
          message: `Unhandled Promise Rejection: ${reason}`,
          filename: 'unknown',
          lineno: 0,
          colno: 0,
          error: reason instanceof Error ? reason : new Error(String(reason))
        });
      });
    }
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  reportJavaScriptError(errorInfo: {
    message: string;
    filename: string;
    lineno: number;
    colno: number;
    error?: Error;
  }): void {
    if (!this.isEnabled) return;

    const errorKey = `js-${errorInfo.message}-${errorInfo.filename}-${errorInfo.lineno}`;
    if (this.isRateLimited(errorKey)) return;

    const severity = this.determineSeverity(errorInfo.message, errorInfo.error);

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'javascript',
      severity,
      message: errorInfo.message,
      stack: errorInfo.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: {
        filename: errorInfo.filename,
        lineno: errorInfo.lineno,
        colno: errorInfo.colno,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer
      }
    };

    this.queueError(errorReport);
  }

  reportAPIError(details: APIErrorDetails, error?: Error): void {
    if (!this.isEnabled) return;

    const errorKey = `api-${details.endpoint}-${details.status}`;
    if (this.isRateLimited(errorKey)) return;

    const severity = this.determineAPISeverity(details.status);

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'api',
      severity,
      message: `API Error: ${details.method} ${details.endpoint} - ${details.status} ${details.statusText}`,
      stack: error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: {
        ...details,
        pathname: window.location.pathname,
        timestamp: Date.now()
      }
    };

    this.queueError(errorReport);
  }

  reportNetworkError(url: string, error: Error): void {
    if (!this.isEnabled) return;

    const errorKey = `network-${url}`;
    if (this.isRateLimited(errorKey)) return;

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'network',
      severity: 'high',
      message: `Network Error: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: {
        targetUrl: url,
        networkError: error.name,
        pathname: window.location.pathname
      }
    };

    this.queueError(errorReport);
  }

  reportComponentError(details: ComponentErrorDetails, error: Error): void {
    if (!this.isEnabled) return;

    const errorKey = `component-${details.componentName}-${error.message}`;
    if (this.isRateLimited(errorKey)) return;

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'component',
      severity: 'medium',
      message: `Component Error in ${details.componentName}: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: {
        ...details,
        pathname: window.location.pathname
      }
    };

    this.queueError(errorReport);
  }

  private determineSeverity(message: string, error?: Error): ErrorReport['severity'] {
    // Critical errors
    if (
      message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') ||
      message.includes('Script error') ||
      error?.name === 'ChunkLoadError'
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      message.includes('TypeError') ||
      message.includes('ReferenceError') ||
      message.includes('SyntaxError') ||
      message.includes('Unhandled Promise Rejection')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (
      message.includes('Warning') ||
      message.includes('Deprecated')
    ) {
      return 'medium';
    }

    return 'low';
  }

  private determineAPISeverity(status: number): ErrorReport['severity'] {
    if (status >= 500) return 'critical';
    if (status >= 400) return 'high';
    if (status >= 300) return 'medium';
    return 'low';
  }

  private isRateLimited(errorKey: string): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Clean old entries
    const entriesToDelete: string[] = [];
    this.rateLimitMap.forEach((timestamp, key) => {
      if (timestamp < windowStart) {
        entriesToDelete.push(key);
      }
    });
    entriesToDelete.forEach(key => this.rateLimitMap.delete(key));

    // Count errors for this key in the current window
    let count = 0;
    this.rateLimitMap.forEach((timestamp, key) => {
      if (key.startsWith(errorKey) && timestamp >= windowStart) {
        count++;
      }
    });

    if (count >= this.maxErrorsPerWindow) {
      return true;
    }

    // Add this error to the rate limit map
    this.rateLimitMap.set(`${errorKey}-${now}`, now);
    return false;
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private queueError(errorReport: ErrorReport): void {
    this.errorQueue.push(errorReport);

    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error tracked:', errorReport);
    }
  }

  private startPeriodicReporting(): void {
    // Report errors every 30 seconds
    setInterval(() => {
      this.flushErrors();
    }, 30000);

    // Report errors before page unload
    window.addEventListener('beforeunload', () => {
      this.flushErrors(true);
    });

    // Report errors when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushErrors();
      }
    });
  }

  private async flushErrors(isBeforeUnload = false): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errorsToReport = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const payload = {
        errors: errorsToReport,
        sessionId: this.sessionId,
        userId: this.userId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      if (isBeforeUnload && navigator.sendBeacon) {
        // Use sendBeacon for reliable reporting during page unload
        navigator.sendBeacon(
          this.reportingEndpoint,
          JSON.stringify(payload)
        );
      } else {
        // Use fetch for normal reporting
        await fetch(this.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          // Don't wait for response during unload
          keepalive: isBeforeUnload
        });
      }
    } catch (error) {
      // If reporting fails, put errors back in queue (unless it's before unload)
      if (!isBeforeUnload) {
        this.errorQueue.unshift(...errorsToReport);
        console.warn('Failed to report errors:', error);
      }
    }
  }

  // Manual error reporting methods
  reportCustomError(message: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'javascript',
      severity: 'medium',
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: {
        ...metadata,
        pathname: window.location.pathname,
        custom: true
      }
    };

    this.queueError(errorReport);
  }

  // Get error statistics
  getErrorStats(): {
    queueSize: number;
    sessionId: string;
    userId?: string;
    rateLimitEntries: number;
  } {
    return {
      queueSize: this.errorQueue.length,
      sessionId: this.sessionId,
      userId: this.userId,
      rateLimitEntries: this.rateLimitMap.size
    };
  }

  // Clear error queue (for testing)
  clearErrors(): void {
    this.errorQueue = [];
    this.rateLimitMap.clear();
  }
}

// Create global error tracker instance
const errorTracker = new ErrorTracker();

// Enhanced fetch wrapper that automatically reports API errors
export const trackedFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method || 'GET';

  try {
    const response = await fetch(input, init);

    // Report API errors for non-2xx responses
    if (!response.ok) {
      const responseBody = await response.clone().text().catch(() => null);
      
      errorTracker.reportAPIError({
        endpoint: url,
        method,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseBody ? responseBody.substring(0, 1000) : null, // Limit size
        requestBody: init?.body ? String(init.body).substring(0, 1000) : null,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    return response;
  } catch (error) {
    // Report network errors
    if (error instanceof Error) {
      errorTracker.reportNetworkError(url, error);
    }
    throw error;
  }
};

// React Error Boundary helper
export const reportComponentError = (
  componentName: string,
  error: Error,
  errorInfo?: { componentStack?: string }
): void => {
  errorTracker.reportComponentError(
    {
      componentName,
      componentStack: errorInfo?.componentStack
    },
    error
  );
};

// Manual error reporting
export const reportError = (message: string, metadata?: Record<string, any>): void => {
  errorTracker.reportCustomError(message, metadata);
};

// Set user ID for error tracking
export const setErrorTrackingUserId = (userId: string): void => {
  errorTracker.setUserId(userId);
};

// Enable/disable error tracking
export const enableErrorTracking = (): void => {
  errorTracker.enable();
};

export const disableErrorTracking = (): void => {
  errorTracker.disable();
};

// Get error tracking statistics
export const getErrorTrackingStats = () => {
  return errorTracker.getErrorStats();
};

// Clear error queue (for testing)
export const clearErrorQueue = (): void => {
  errorTracker.clearErrors();
};

export default errorTracker;