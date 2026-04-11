export type PaginationOutput = Record<string, unknown>;

export type BaseResponse<T = null> = {
  success: boolean;
  message: string;
  pagination?: PaginationOutput;
  data?: T;
};
