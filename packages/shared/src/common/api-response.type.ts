import { ErrorDetail } from './error.type';
import { PaginationMeta } from './pagination.type';

interface BaseResponse {
  success: boolean;
  timestamp: string;
  path: string;
}

export interface ApiSuccessResponse<T> extends BaseResponse {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse extends BaseResponse {
  success: false;
  message: string;
  errors?: ErrorDetail[];
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
