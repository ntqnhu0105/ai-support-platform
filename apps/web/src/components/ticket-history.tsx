'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { describeHistoryEntry } from '@/lib/history';
import { fetchHistory } from '@/lib/tickets-api';

export function TicketHistory({ ticketId }: { ticketId: string }) {
  const query = useQuery({
    queryKey: ['history', ticketId],
    queryFn: () => fetchHistory(ticketId),
  });
  const entries = query.data;

  return (
    <section className="mt-6" aria-label="History">
      <h2 className="text-sm font-semibold text-zinc-900">History</h2>

      {query.isError ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {query.error instanceof ApiError ? query.error.message : 'Could not load the history.'}
        </p>
      ) : !entries ? (
        <p className="mt-3 text-sm text-zinc-500">Loading history...</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l border-zinc-200 pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="text-zinc-800">{describeHistoryEntry(entry)}</p>
              <p className="text-xs text-zinc-400">{formatDateTime(entry.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}