/**
 * Production Ready Logger
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  data?: any;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private requestId: string = '';

  /**
   * Set request ID for correlation
   */
  setRequestId(id: string): void {
    this.requestId = id;
  }

  /**
   * Generate unique request ID
   */
  static generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Format log entry
   */
  private formatLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    error?: any,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId || 'unknown',
      message,
      data,
      duration,
      error: error
        ? {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        : undefined
    };
  }

  /**
   * Output log
   */
  private output(entry: LogEntry): void {
    const logStr = JSON.stringify(entry);

    if (process.env.NODE_ENV === 'development') {
      console.log(logStr);
    } else {
      // In production, send to logging service
      console.log(logStr);
    }
  }

  debug(message: string, data?: any): void {
    this.output(this.formatLogEntry(LogLevel.DEBUG, message, data));
  }

  info(message: string, data?: any): void {
    this.output(this.formatLogEntry(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: any): void {
    this.output(this.formatLogEntry(LogLevel.WARN, message, data));
  }

  error(message: string, error?: any, data?: any): void {
    this.output(this.formatLogEntry(LogLevel.ERROR, message, data, error));
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.output(
      this.formatLogEntry(
        statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
        `${method} ${path}`,
        { statusCode },
        undefined,
        duration
      )
    );
  }
}

export const logger = new Logger();
