/**
 * Log level types for structured logging.
 * DEBUG: Development-only verbose logs
 * INFO: General information
 * WARN: Warning messages
 * ERROR: Error conditions with stack traces
 * AUDIT: Security and compliance audit events
 * @author Maruf Bepary
 */
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "AUDIT";

/**
 * Structured log entry format.
 * @author Maruf Bepary
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  traceId?: string;
}

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "credentials",
  "email",
  "account_id",
  "authorization",
  "cookie",
];

/**
 * Recursively sanitizes an object by masking sensitive keys.
 * Redacts passwords, tokens, API keys, emails, and other sensitive data
 * to prevent them from appearing in logs.
 *
 * @param obj - Object to sanitize (may be nested)
 * @returns Sanitized copy with sensitive values replaced by '[REDACTED]'
 * @author Maruf Bepary
 */
function sanitize(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (
        SENSITIVE_KEYS.some((sk) =>
          key.toLowerCase().includes(sk.toLowerCase()),
        )
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitize(obj[key]);
      }
    }
  }
  return sanitized;
}

/**
 * Serializes an error object into a plain object for JSON logging.
 * Extracts name, message, and stack trace; preserves custom properties.
 *
 * @param err - Error object to serialize
 * @returns Plain object with error details
 * @author Maruf Bepary
 */
function serializeError(err: any): any {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err as any),
    };
  }
  return err;
}

const formatLog = (entry: LogEntry) => {
  const sanitizedEntry = {
    ...entry,
    context: entry.context ? sanitize(entry.context) : undefined,
  };
  return JSON.stringify(sanitizedEntry, null, 2);
};

const isDev = process.env.NODE_ENV === "development";

/**
 * Structured logger for consistent application-wide logging.
 * Supports development/production modes, sanitization of sensitive data,
 * and optional user/trace context for request correlation.
 *
 * Usage:
 * ```
 * logger.info('User logged in', { userId: 123 }, userId, traceId);
 * logger.error('API call failed', error, { endpoint: '/api/chat' }, userId);
 * logger.audit('Account deleted', { userId, reason: 'user_request' });
 * ```
 *
 * @author Maruf Bepary
 */
export const logger = {
  /**
   * Logs a debug message (development-only).
   * @param msg - Message to log
   * @param ctx - Optional context object
   * @param userId - Optional authenticated user ID for correlation
   * @param traceId - Optional trace ID for request correlation
   * @author Maruf Bepary
   */
  debug: (msg: string, ctx?: any, userId?: string, traceId?: string) => {
    if (isDev) {
      console.debug(
        formatLog({
          timestamp: new Date().toISOString(),
          level: "DEBUG",
          message: msg,
          context: ctx,
          userId,
          traceId,
        }),
      );
    }
  },
  /**
   * Logs an info message to record general application events.
   * @param msg - Message to log
   * @param ctx - Optional context object
   * @param userId - Optional authenticated user ID for correlation
   * @param traceId - Optional trace ID for request correlation
   * @author Maruf Bepary
   */
  info: (msg: string, ctx?: any, userId?: string, traceId?: string) => {
    console.log(
      formatLog({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: msg,
        context: ctx,
        userId,
        traceId,
      }),
    );
  },
  /**
   * Logs a warning for potentially problematic conditions.
   * @param msg - Message to log
   * @param ctx - Optional context object
   * @param userId - Optional authenticated user ID for correlation
   * @param traceId - Optional trace ID for request correlation
   * @author Maruf Bepary
   */
  warn: (msg: string, ctx?: any, userId?: string, traceId?: string) => {
    console.warn(
      formatLog({
        timestamp: new Date().toISOString(),
        level: "WARN",
        message: msg,
        context: ctx,
        userId,
        traceId,
      }),
    );
  },
  /**
   * Logs an error with full context and stack trace.
   * @param msg - Message to log
   * @param err - Error object (will be serialized with stack)
   * @param ctx - Optional additional context object
   * @param userId - Optional authenticated user ID for correlation
   * @param traceId - Optional trace ID for request correlation
   * @author Maruf Bepary
   */
  error: (
    msg: string,
    err?: any,
    ctx?: any,
    userId?: string,
    traceId?: string,
  ) => {
    console.error(
      formatLog({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message: msg,
        context: {
          ...ctx,
          error: serializeError(err),
        },
        userId,
        traceId,
      }),
    );
  },
  /**
   * Logs a security audit event (e.g., login, permission change, account deletion).
   * @param action - Action being audited
   * @param metadata - Audit metadata, must include userId and relevant context
   * @param traceId - Optional trace ID for request correlation
   * @author Maruf Bepary
   */
  audit: (
    action: string,
    metadata: { userId: string; [key: string]: any },
    traceId?: string,
  ) => {
    console.log(
      formatLog({
        timestamp: new Date().toISOString(),
        level: "AUDIT",
        message: action,
        context: metadata,
        userId: metadata.userId,
        traceId,
      }),
    );
  },
};
