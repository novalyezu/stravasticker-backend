import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { X_REQUEST_ID_HEADER } from '../constants';

type RequestWithId = Request & { requestId?: string };

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const requestId = this.resolveRequestId(request, response);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        response.status(status).json({
          statusCode: status,
          message: exceptionResponse,
          requestId,
        });
        return;
      }

      if (this.isRecord(exceptionResponse)) {
        response.status(status).json({
          ...exceptionResponse,
          requestId,
        });
        return;
      }

      response.status(status).json({
        statusCode: status,
        message: exception.message,
        requestId,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      requestId,
    });
  }

  private resolveRequestId(request: RequestWithId, response: Response): string {
    const responseRequestId = response.getHeader(X_REQUEST_ID_HEADER);
    const fromResponse =
      typeof responseRequestId === 'string' ? responseRequestId : undefined;

    return (
      request.requestId ||
      request.header(X_REQUEST_ID_HEADER) ||
      fromResponse ||
      'unknown'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
