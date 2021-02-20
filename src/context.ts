import {SearchQuery} from './query';

export type SearchContext = {
  query?: SearchQuery;
  limit?: number;
  // lastVisible?: string;
};

export function createSearchContext(): SearchContext {
  return {};
}
