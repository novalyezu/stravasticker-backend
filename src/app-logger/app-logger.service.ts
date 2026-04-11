import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';
type LogMeta = Record<string, unknown>;

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('log', message, this.normalizeContext(contextOrMeta));
  }

  warn(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('warn', message, this.normalizeContext(contextOrMeta));
  }

  debug?(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('debug', message, this.normalizeContext(contextOrMeta));
  }

  verbose?(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write('verbose', message, this.normalizeContext(contextOrMeta));
  }

  fatal?(message: unknown, contextOrMeta?: string | LogMeta): void {
    this.write(
      'fatal',
      message,
      this.normalizeContext(contextOrMeta),
      'stderr',
    );
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const meta: LogMeta = {};
    const [first, second] = optionalParams;

    if (typeof first === 'string' && first.trim().length > 0) {
      meta.trace = first;
    } else if (this.isRecord(first)) {
      Object.assign(meta, first);
    }

    if (typeof second === 'string' && second.trim().length > 0) {
      meta.context = second;
    } else if (this.isRecord(second)) {
      Object.assign(meta, second);
    }

    this.write('error', message, meta, 'stderr');
  }

  info(message: string, meta?: LogMeta): void {
    this.write('log', message, meta);
  }

  errorWithMeta(message: string, meta?: LogMeta): void {
    this.write('error', message, meta, 'stderr');
  }

  private write(
    level: LogLevel,
    message: unknown,
    meta: LogMeta = {},
    stream: 'stdout' | 'stderr' = 'stdout',
  ): void {
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message: this.normalizeMessage(message),
      ...meta,
    };

    const line = JSON.stringify(entry);
    const output = `${line}\n`;

    if (stream === 'stderr') {
      process.stderr.write(output);
      return;
    }

    process.stdout.write(output);
  }

  private normalizeMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private normalizeContext(contextOrMeta?: string | LogMeta): LogMeta {
    if (!contextOrMeta) {
      return {};
    }

    if (typeof contextOrMeta === 'string') {
      return { context: contextOrMeta };
    }

    return contextOrMeta;
  }

  private isRecord(value: unknown): value is LogMeta {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
