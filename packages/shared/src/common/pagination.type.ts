export interface PaginationMeta {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
