import { supabase } from '../../lib/supabase';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  context?: LogContext;
  traceId?: string;
  userId?: string;
  requestId?: string;
  error?: Error;
}

class Logger {
  private serviceName: string;
  private defaultContext: LogContext;

  constructor(serviceName: string, defaultContext: LogContext = {}) {
    this.serviceName = serviceName;
    this.defaultContext = defaultContext;
  }

  async log(entry: Omit<LogEntry, 'service'>): Promise<void> {
    const logEntry: LogEntry = {
      ...entry,
      service: this.serviceName,
      context: {
        ...this.defaultContext,
        ...entry.context,
      },
    };

    this.logToConsole(logEntry);

    try {
      await this.logToDatabase(logEntry);
    } catch (error) {
      console.error('Failed to log to database:', error);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level: entry.level,
      service: entry.service,
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.traceId && { traceId: entry.traceId }),
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        },
      }),
    };

    const formatted = JSON.stringify(logData);

    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
    }
  }

  private async logToDatabase(entry: LogEntry): Promise<void> {
    try {
      await supabase.from('application_logs').insert({
        level: entry.level,
        service_name: entry.service,
        message: entry.message,
        context: entry.context || {},
        trace_id: entry.traceId,
        user_id: entry.userId,
        request_id: entry.requestId,
        error_type: entry.error?.name,
        error_message: entry.error?.message,
        stack_trace: entry.error?.stack,
      });
    } catch (error) {
      console.error('Database logging failed:', error);
    }
  }

  debug(message: string, context?: LogContext): Promise<void> {
    return this.log({ level: 'debug', message, context });
  }

  info(message: string, context?: LogContext): Promise<void> {
    return this.log({ level: 'info', message, context });
  }

  warn(message: string, context?: LogContext): Promise<void> {
    return this.log({ level: 'warn', message, context });
  }

  error(message: string, error?: Error, context?: LogContext): Promise<void> {
    return this.log({ level: 'error', message, error, context });
  }

  fatal(message: string, error?: Error, context?: LogContext): Promise<void> {
    return this.log({ level: 'fatal', message, error, context });
  }

  child(additionalContext: LogContext): Logger {
    return new Logger(this.serviceName, {
      ...this.defaultContext,
      ...additionalContext,
    });
  }

  withTrace(traceId: string): Logger {
    return this.child({ traceId });
  }

  withUser(userId: string): Logger {
    return this.child({ userId });
  }
}

export function createLogger(serviceName: string, context?: LogContext): Logger {
  return new Logger(serviceName, context);
}

export const logger = createLogger('app');
