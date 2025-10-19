import { PaginationQuery } from './pagination.type';
import { SortQuery } from './sort.type';

export interface BaseFilterQuery extends PaginationQuery, SortQuery {
  search?: string;
}
