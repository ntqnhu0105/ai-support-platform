export const STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const SORTS = ['newest', 'oldest', 'priority'] as const;

export type TicketStatus = (typeof STATUSES)[number];
export type TicketPriority = (typeof PRIORITIES)[number];
export type TicketSort = (typeof SORTS)[number];

export const PAGE_SIZE = 10;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 100;

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  sort: TicketSort;
  q?: string;
  page: number;
}

interface SearchParamsLike {
  get(name: string): string | null;
}

function pick<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return allowed.find((item) => item === value);
}

export const asStatus = (value: string) => pick(STATUSES, value);
export const asPriority = (value: string) => pick(PRIORITIES, value);
export const asSort = (value: string): TicketSort => pick(SORTS, value) ?? 'newest';

/** Reads filters from a URL. Anything unknown or invalid is ignored, never forwarded to the API. */
export function parseTicketFilters(params: SearchParamsLike): TicketFilters {
  const rawPage = Number(params.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= MAX_PAGE ? rawPage : 1;

  return {
    status: pick(STATUSES, params.get('status')),
    priority: pick(PRIORITIES, params.get('priority')),
    sort: pick(SORTS, params.get('sort')) ?? 'newest',
    q: params.get('q')?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    page,
  };
}

/** Builds the browser URL query. Defaults are left out so URLs stay short and clean. */
export function toSearchString(filters: TicketFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.q) params.set('q', filters.q);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

/** Builds the query string sent to the API. */
export function toApiQuery(filters: TicketFilters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(PAGE_SIZE),
    sort: filters.sort,
  });
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.q) params.set('q', filters.q);
  return params.toString();
}