type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  traceId?: string;
}

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'credentials',
  'email',
  'account_id',
  'authorization',
  'cookie',
];

/**
 * Recursively sanitizes an object by masking sensitive keys.
 */
function sanitize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(obj[key]);
      }
    }
  }
  return sanitized;
}

/**
 * Serializes an error object into a plain object for JSON logging.
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
  return JSON.stringify(sanitizedEntry);
};

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (msg: string, ctx?: any, userId?: string, traceId?: string) => {
    if (isDev) {
      console.debug(
        formatLog({
          timestamp: new Date().toISOString(),
          level: 'DEBUG',
          message: msg,
          context: ctx,
          userId,
          traceId,
        })
      );
    }
  },
  info: (msg: string, ctx?: any, userId?: string, traceId?: string) => {
    console.log(
      formatLog({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: msg,
        context: ctx,
        userId,
        traceId,
      })
    );
  },
  warn: (msg: string, ctx?: any, userId?: string, traceId?: string) => {
    console.warn(
      formatLog({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: msg,
        context: ctx,
        userId,
        traceId,
      })
    );
  },
  error: (msg: string, err?: any, ctx?: any, userId?: string, traceId?: string) => {
    console.error(
      formatLog({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: msg,
        context: {
          ...ctx,
          error: serializeError(err),
        },
        userId,
        traceId,
      })
    );
  },
  audit: (action: string, metadata: { userId: string; [key: string]: any }, traceId?: string) => {
    console.log(
      formatLog({
        timestamp: new Date().toISOString(),
        level: 'AUDIT',
        message: action,
        context: metadata,
        userId: metadata.userId,
        traceId,
      })
    );
  },
};
