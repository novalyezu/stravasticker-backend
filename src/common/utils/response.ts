import { BaseResponse, PaginationOutput } from '../types/response.type';

export function ok<T>(
  data: T,
  message = 'OK',
  pagination?: PaginationOutput,
): BaseResponse<T> {
  return {
    success: true,
    message,
    data,
    ...(pagination ? { pagination } : {}),
  };
}

export function created<T>(data: T, message = 'Created'): BaseResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}
