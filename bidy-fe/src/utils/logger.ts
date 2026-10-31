/**
 * Frontend Logger utility for consistent logging across the React application
 * Supports multiple log levels with environment-based filtering
 * Includes timestamps, structured output, and browser-specific features
 */

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

interface LogMeta {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: LogMeta;
  url?: string;
  userAgent?: string;
  userId?: string;
}

class FrontendLogger {
  private logLevels: Record<string, number> = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  private currentLevel: number;
  private enableStorage: boolean;
  private maxStorageEntries: number;

  constructor() {
    this.currentLevel = this.getLogLevel();
    this.enableStorage = this.getStorageEnabled();
    this.maxStorageEntries = 1000;
    
    // Initialize storage cleanup
    if (this.enableStorage) {
      this.cleanupOldLogs();
    }
  }

  private getLogLevel(): number {
    if (typeof window === 'undefined') return this.logLevels.INFO;
    
    try {
      const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || 'INFO';
      const level = this.logLevels[envLevel.toUpperCase()];
      return level !== undefined ? level : this.logLevels.INFO;
    } catch {
      return this.logLevels.INFO;
    }
  }

  private getStorageEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      return process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true' || process.env.NODE_ENV === 'development';
    } catch {
      return false;
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    
    try {
      if (process.env.NODE_ENV === 'production') {
        return `[${timestamp}] [${level}] ${message}`;
      }
    } catch {
      // Fallback if NODE_ENV is not accessible
      return `[${timestamp}] [${level}] ${message}`;
    }

    // Development format with better visibility
    return `%c[${level}]%c ${message}`;
  }

  private getConsoleMethod(level: string) {
    switch (level) {
      case 'ERROR': return console.error;
      case 'WARN': return console.warn;
      case 'INFO': return console.info;
      case 'DEBUG': return console.debug;
      default: return console.log;
    }
  }

  private storeLog(level: string, message: string, meta: LogMeta = {}) {
    if (!this.enableStorage || typeof window === 'undefined') return;

    try {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        meta,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.getCurrentUserId()
      };

      const logs = this.getStoredLogs();
      logs.push(logEntry);

      // Keep only recent logs
      if (logs.length > this.maxStorageEntries) {
        logs.splice(0, logs.length - this.maxStorageEntries);
      }

      localStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (error) {
      // Fallback to console if storage fails
      console.warn('Failed to store log entry:', error);
    }
  }

  private getCurrentUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    
    try {
      const userCookie = localStorage.getItem('currentUser');
      if (userCookie) {
        const user = JSON.parse(userCookie);
        return user.id || user._id;
      }
    } catch {
      // Ignore parsing errors
    }
    return undefined;
  }

  private getStoredLogs(): LogEntry[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem('app_logs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private cleanupOldLogs() {
    if (typeof window === 'undefined') return;
    
    try {
      const logs = this.getStoredLogs();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentLogs = logs.filter(log => 
        new Date(log.timestamp) > oneDayAgo
      );

      if (recentLogs.length < logs.length) {
        localStorage.setItem('app_logs', JSON.stringify(recentLogs));
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private log(level: string, message: string, meta: LogMeta = {}) {
    const levelNum = this.logLevels[level];
    if (levelNum > this.currentLevel) {
      return; // Skip if log level is below current threshold
    }

    const formattedMessage = this.formatMessage(level, message);
    const consoleMethod = this.getConsoleMethod(level);

    // Console output
    try {
      if (process.env.NODE_ENV === 'development') {
        const colors = {
          ERROR: 'color: #ff4444; font-weight: bold;',
          WARN: 'color: #ffaa00; font-weight: bold;',
          INFO: 'color: #0088ff; font-weight: bold;',
          DEBUG: 'color: #888888;'
        };
        
        const style = colors[level as keyof typeof colors] || '';
        consoleMethod(formattedMessage, style, 'color: inherit;', meta);
      } else {
        consoleMethod(formattedMessage, meta);
      }
    } catch {
      // Fallback to simple console output if environment check fails
      consoleMethod(formattedMessage, meta);
    }

    // Store log for later retrieval
    this.storeLog(level, message, meta);
  }

  // Public methods
  error(message: string, error?: Error | unknown, meta: LogMeta = {}) {
    const errorMeta: LogMeta = error ? {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      ...meta
    } : meta;

    this.log('ERROR', message, errorMeta);
  }

  warn(message: string, meta: LogMeta = {}) {
    this.log('WARN', message, meta);
  }

  info(message: string, meta: LogMeta = {}) {
    this.log('INFO', message, meta);
  }

  debug(message: string, meta: LogMeta = {}) {
    this.log('DEBUG', message, meta);
  }

  // Utility methods
  startTimer(label: string) {
    const start = Date.now();
    return {
      end: (message = `Timer ${label} completed`) => {
        const duration = Date.now() - start;
        this.info(message, { duration: `${duration}ms`, timer: label });
        return duration;
      }
    };
  }

  // API call logging
  api(method: string, url: string, status?: number, meta: LogMeta = {}) {
    const apiInfo = {
      method: method.toUpperCase(),
      url,
      status,
      timestamp: new Date().toISOString(),
      ...meta
    };

    if (status && status >= 400) {
      this.error(`API Error: ${method.toUpperCase()} ${url}`, null, apiInfo);
    } else {
      this.debug(`API Call: ${method.toUpperCase()} ${url}`, apiInfo);
    }
  }

  // User action logging
  userAction(action: string, meta: LogMeta = {}) {
    this.info(`User Action: ${action}`, {
      action,
      userId: this.getCurrentUserId(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      ...meta
    });
  }

  // Performance logging
  performance(metric: string, value: number, unit = 'ms', meta: LogMeta = {}) {
    this.info(`Performance: ${metric}`, { 
      metric, 
      value, 
      unit, 
      url: typeof window !== 'undefined' ? window.location.pathname : '',
      ...meta 
    });
  }

  // Component lifecycle logging
  component(componentName: string, lifecycle: 'mount' | 'unmount' | 'update', meta: LogMeta = {}) {
    this.debug(`Component ${lifecycle}: ${componentName}`, { 
      component: componentName, 
      lifecycle,
      ...meta 
    });
  }

  // Get stored logs for debugging
  getLogs(level?: string, limit = 100): LogEntry[] {
    const logs = this.getStoredLogs();
    
    let filteredLogs = logs;
    if (level) {
      const levelNum = this.logLevels[level.toUpperCase()];
      filteredLogs = logs.filter(log => 
        this.logLevels[log.level] <= levelNum
      );
    }

    return filteredLogs.slice(-limit);
  }

  // Clear stored logs
  clearLogs() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_logs');
      this.info('Logs cleared');
    }
  }

  // Export logs as JSON
  exportLogs(): string {
    const logs = this.getStoredLogs();
    return JSON.stringify(logs, null, 2);
  }
}

// Create singleton instance
const logger = new FrontendLogger();

// Add global error handling
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      logger.error('Global Error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      });
    } catch (loggingError) {
      // Prevent infinite loop - use plain console if logger fails
      console.error('Logger failed while handling global error:', loggingError);
      console.error('Original error:', event.error);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      logger.error('Unhandled Promise Rejection', event.reason, {
        type: 'unhandledrejection'
      });
    } catch (loggingError) {
      // Prevent infinite loop - use plain console if logger fails
      console.error('Logger failed while handling unhandled rejection:', loggingError);
      console.error('Original rejection:', event.reason);
    }
  });
}

export default logger;