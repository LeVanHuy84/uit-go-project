export type SortOrder = 'asc' | 'desc' | '';

export interface SortQuery {
  sortBy?: string;
  sortOrder?: SortOrder;
}
