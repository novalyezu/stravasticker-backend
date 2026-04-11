import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { AppLoggerService } from '../../app-logger/app-logger.service';
import { redactSensitiveData } from '../logging/redaction.util';
import { X_REQUEST_ID_HEADER } from '../constants';

type RequestWithMeta = Request & { requestId?: string; user?: { id?: string } };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<RequestWithMeta>();
    const res = httpContext.getResponse<Response>();
    const startedAt = Date.now();

    const requestId =
      req.requestId ||
      req.header(X_REQUEST_ID_HEADER) ||
      (res.getHeader(X_REQUEST_ID_HEADER) as string | undefined) ||
      null;

    const method = req.method;
    const url = req.originalUrl || req.url;
    const route = this.readRoutePath(req);
    const userId = req.user?.id ?? null;
    const shouldSkip = this.shouldSkipRequest(url);

    return next.handle().pipe(
      tap(() => {
        if (shouldSkip) {
          return;
        }

        this.logger.info('HTTP request completed', {
          requestId,
          method,
          url,
          route,
          statusCode: res.statusCode,
          latencyMs: Date.now() - startedAt,
          userId,
        });
      }),
      catchError((error: unknown) => {
        if (!shouldSkip) {
          this.logger.errorWithMeta('HTTP request failed', {
            requestId,
            method,
            url,
            route,
            statusCode:
              res.statusCode >= 400
                ? res.statusCode
                : this.readErrorStatus(error),
            latencyMs: Date.now() - startedAt,
            userId,
            request: redactSensitiveData({
              params: req.params,
              query: req.query,
              body: req.body as unknown,
            }),
            error: redactSensitiveData(error),
          });
        }

        return throwError(() => error);
      }),
    );
  }

  private shouldSkipRequest(url: string): boolean {
    return url.startsWith('/health') || url.startsWith('/metrics');
  }

  private readRoutePath(req: RequestWithMeta): string | null {
    const rawReq = req as unknown as { route?: unknown };
    const route = rawReq.route;
    if (typeof route !== 'object' || route === null) {
      return null;
    }

    if (
      'path' in route &&
      typeof (route as { path?: unknown }).path === 'string'
    ) {
      return (route as { path: string }).path;
    }

    return null;
  }

  private readErrorStatus(error: unknown): number {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
    ) {
      return (error as { status: number }).status;
    }

    return 500;
  }
}
