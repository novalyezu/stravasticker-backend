import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '../types/response.type';

type PaginatedPayload = {
  data: unknown;
  pagination: Record<string, unknown>;
};

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponse<unknown>> {
    return next.handle().pipe(map((value) => this.wrap(value)));
  }

  private wrap(value: unknown): BaseResponse<unknown> {
    if (this.isBaseResponse(value)) {
      return value;
    }

    if (this.isPaginatedPayload(value)) {
      return {
        success: true,
        message: 'OK',
        data: value.data ?? null,
        pagination: value.pagination,
      };
    }

    return {
      success: true,
      message: 'OK',
      data: value ?? null,
    };
  }

  private isBaseResponse(value: unknown): value is BaseResponse<unknown> {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value.success === 'boolean' && typeof value.message === 'string'
    );
  }

  private isPaginatedPayload(value: unknown): value is PaginatedPayload {
    if (!this.isRecord(value)) {
      return false;
    }

    return 'data' in value && 'pagination' in value;
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
