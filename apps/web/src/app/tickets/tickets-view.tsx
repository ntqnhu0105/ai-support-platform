'use client';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PriorityBadge, StatusBadge } from '@/components/badge';
import { formatLabel } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { useRedirectWhenSessionExpires, useRequireSession } from '@/lib/use-session-guard';
import {
  PRIORITIES,
  STATUSES,
  asPriority,
  asSort,
  asStatus,
  parseTicketFilters,
  toSearchString,
  type TicketFilters,
  type TicketSort,
} from '@/lib/ticket-filters';
import { fetchTickets } from '@/lib/tickets-api';

const SORT_LABELS: Record<TicketSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  priority: 'Highest priority first',
};

const SEARCH_DEBOUNCE_MS = 300;
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const controlClass =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500';

export function TicketsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, logout } = useRequireSession();

  const filters = useMemo(() => parseTicketFilters(searchParams), [searchParams]);
  const authenticated = state.status === 'authenticated';

  // The text box keeps its own value while typing; the URL only follows after a short pause.
  const urlQuery = filters.q ?? '';
  const [searchText, setSearchText] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    // The URL changed (Back button, "Clear filters"...). Follow it, unless it is just our own
    // typing coming back trimmed, so a trailing space is not removed while the user types.
    setLastUrlQuery(urlQuery);
    if (urlQuery !== searchText.trim()) setSearchText(urlQuery);
  }

  const navigate = useCallback(
    (changes: Partial<TicketFilters>, mode: 'push' | 'replace' = 'push') => {
      const next: TicketFilters = { ...filters, ...changes };
      if (!('page' in changes)) next.page = 1; // any filter change starts again from page 1
      const search = toSearchString(next);
      const url = search ? `${pathname}?${search}` : pathname;
      if (mode === 'replace') router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [filters, pathname, router],
  );

  useEffect(() => {
    if (searchText.trim() === urlQuery) return;
    const timer = setTimeout(() => {
      navigate({ q: searchText.trim() || undefined }, 'replace');
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, urlQuery, navigate]);

  const query = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => fetchTickets(filters),
    enabled: authenticated,
    placeholderData: keepPreviousData,
  });

    useRedirectWhenSessionExpires(query.error)

  if (state.status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading...
      </main>
    );
  }

  const { user } = state;
  const data = query.data;
  const hasFilters = Boolean(filters.status || filters.priority || filters.q);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Tickets</h1>
          <p className="text-sm text-zinc-500">
            {user.name ?? user.email} ({user.role})
          </p>
        </div>
                <div className="flex items-center gap-2">
          {user.role === 'CUSTOMER' && (
            <Link
              href="/tickets/new"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              New ticket
            </Link>
          )}
          <button
            onClick={onLogout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search tickets"
          placeholder="Search subject, text or code"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={`${controlClass} min-w-64 flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={filters.status ?? ''}
          onChange={(e) => navigate({ status: asStatus(e.target.value) })}
          className={controlClass}
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatLabel(status)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={filters.priority ?? ''}
          onChange={(e) => navigate({ priority: asPriority(e.target.value) })}
          className={controlClass}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {formatLabel(priority)}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort tickets"
          value={filters.sort}
          onChange={(e) => navigate({ sort: asSort(e.target.value) })}
          className={controlClass}
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => router.push(pathname, { scroll: false })}
            className="text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            Clear filters
          </button>
        )}
      </div>

      <section className="mt-4" aria-live="polite">
        {query.isError ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{query.error instanceof ApiError ? query.error.message : 'Could not load tickets.'}</p>
            <button onClick={() => void query.refetch()} className="mt-2 font-medium underline">
              Try again
            </button>
          </div>
        ) : query.isPending ? (
          <ul className="space-y-2" aria-label="Loading tickets">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-md bg-zinc-100" />
            ))}
          </ul>
        ) : data ? (
          <>
            <p className="mb-2 text-sm text-zinc-500">
              {data.meta.total} {data.meta.total === 1 ? 'ticket' : 'tickets'}
              {data.meta.totalPages > 0 && ` - page ${filters.page} of ${data.meta.totalPages}`}
              {query.isPlaceholderData && ' - updating...'}
            </p>

            <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
              {data.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
                  {data.meta.total > 0 ? (
                    <>
                      <p>This page does not exist.</p>
                      <button
                        onClick={() => navigate({ page: 1 })}
                        className="mt-2 font-medium text-zinc-700 underline"
                      >
                        Go to the first page
                      </button>
                    </>
                  ) : hasFilters ? (
                    <>
                      <p>No tickets match these filters.</p>
                      <button
                        onClick={() => router.push(pathname, { scroll: false })}
                        className="mt-2 font-medium text-zinc-700 underline"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : (
                    <p>No tickets yet.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ticket</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Priority</th>
                        <th className="px-4 py-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    
                      <tbody className="divide-y divide-zinc-200">
                        {data.items.map((ticket) => (
                          <tr key={ticket.id} className="hover:bg-zinc-50">
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="font-mono text-xs text-zinc-500">
                                {ticket.code}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <Link
                                href={`/tickets/${ticket.id}`}
                                className="font-medium text-zinc-900 hover:underline"
                              >
                                {ticket.subject}
                              </Link>
                            </td>

                            <td className="px-4 py-3">
                              <StatusBadge status={ticket.status} />
                            </td>

                            <td className="px-4 py-3">
                              <PriorityBadge priority={ticket.priority} />
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                              {dateFormat.format(new Date(ticket.createdAt))}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                  </table>
                </div>
              )}
            </div>

            {data.meta.totalPages > 1 && (
              <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
                <button
                  onClick={() => navigate({ page: filters.page - 1 })}
                  disabled={filters.page <= 1}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-500">
                  Page {filters.page} of {data.meta.totalPages}
                </span>
                <button
                  onClick={() => navigate({ page: filters.page + 1 })}
                  disabled={filters.page >= data.meta.totalPages}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}