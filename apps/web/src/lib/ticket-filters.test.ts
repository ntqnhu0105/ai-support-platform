import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  parseTicketFilters,
  toApiQuery,
  toSearchString,
  type TicketFilters,
} from './ticket-filters';

const parse = (search: string) => parseTicketFilters(new URLSearchParams(search));

describe('parseTicketFilters', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parse('')).toEqual({
      status: undefined,
      priority: undefined,
      sort: 'newest',
      q: undefined,
      page: 1,
    });
  });

  it('reads valid filters', () => {
    expect(parse('status=OPEN&priority=URGENT&sort=priority&q=refund&page=3')).toEqual({
      status: 'OPEN',
      priority: 'URGENT',
      sort: 'priority',
      q: 'refund',
      page: 3,
    });
  });

  it('ignores unknown status, priority and sort values', () => {
    const filters = parse('status=DONE&priority=CRITICAL&sort=random');

    expect(filters.status).toBeUndefined();
    expect(filters.priority).toBeUndefined();
    expect(filters.sort).toBe('newest');
  });

  it('is case sensitive, so a lowercase status is ignored', () => {
    expect(parse('status=open').status).toBeUndefined();
  });

  it('trims the search text, drops it when blank and caps its length', () => {
    expect(parse('q=%20%20refund%20%20').q).toBe('refund');
    expect(parse('q=%20%20%20').q).toBeUndefined();
    expect(parse(`q=${'a'.repeat(300)}`).q).toHaveLength(100);
  });

  it('falls back to page 1 for every invalid page value', () => {
    for (const value of ['0', '-1', 'abc', '2.5', '', '10001']) {
      expect(parse(`page=${value}`).page, `page=${value}`).toBe(1);
    }
  });

  it('accepts a valid page number', () => {
    expect(parse('page=7').page).toBe(7);
  });
});

describe('toSearchString', () => {
  it('leaves out every default value', () => {
    expect(toSearchString({ sort: 'newest', page: 1 })).toBe('');
  });

  it('includes only the filters that are set', () => {
    expect(toSearchString({ status: 'RESOLVED', sort: 'oldest', page: 2 })).toBe(
      'status=RESOLVED&sort=oldest&page=2',
    );
  });

  it('survives a round trip through the URL', () => {
    const samples: TicketFilters[] = [
      { sort: 'newest', page: 1 },
      { status: 'IN_PROGRESS', priority: 'HIGH', sort: 'priority', q: 'card declined', page: 4 },
      { q: 'a&b=c?d', sort: 'oldest', page: 1 },
    ];

    for (const filters of samples) {
      const roundTripped = parse(toSearchString(filters));
      expect(roundTripped).toEqual({
        status: filters.status,
        priority: filters.priority,
        sort: filters.sort,
        q: filters.q,
        page: filters.page,
      });
    }
  });
});

describe('toApiQuery', () => {
  it('always sends page, page size and sort', () => {
    const params = new URLSearchParams(toApiQuery({ sort: 'newest', page: 1 }));

    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe(String(PAGE_SIZE));
    expect(params.get('sort')).toBe('newest');
    expect(params.has('status')).toBe(false);
  });

  it('sends the optional filters when they are set', () => {
    const params = new URLSearchParams(
      toApiQuery({ status: 'OPEN', priority: 'LOW', sort: 'priority', q: 'refund', page: 2 }),
    );

    expect(params.get('status')).toBe('OPEN');
    expect(params.get('priority')).toBe('LOW');
    expect(params.get('q')).toBe('refund');
    expect(params.get('page')).toBe('2');
  });

  it('encodes search text so it cannot inject other parameters', () => {
    const query = toApiQuery({ q: 'a&status=CLOSED', sort: 'newest', page: 1 });
    const params = new URLSearchParams(query);

    expect(params.get('q')).toBe('a&status=CLOSED');
    expect(params.has('status')).toBe(false);
  });
});