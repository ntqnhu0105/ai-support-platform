'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface TicketSummary {
  id: string;
  code: string;
  subject: string;
  status: string;
  priority: string;
}

interface TicketPage {
  items: TicketSummary[];
  meta: { total: number };
}

export default function TicketsPage() {
  const router = useRouter();
  const { state, logout } = useAuth();
  const [tickets, setTickets] = useState<TicketPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authenticated = state.status === 'authenticated';

  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/login');
  }, [state.status, router]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    apiFetch<TicketPage>('/tickets?pageSize=5&sort=newest')
      .then((data) => {
        if (active) setTickets(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Could not load tickets');
      });
    return () => {
      active = false;
    };
  }, [authenticated]);

  if (state.status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading...
      </main>
    );
  }

  const { user } = state;

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Tickets</h1>
          <p className="text-sm text-zinc-500">
            {user.name ?? user.email} ({user.role})
          </p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          Sign out
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {tickets && (
        <section className="mt-4">
          <p className="text-sm text-zinc-500">{tickets.meta.total} tickets in total, newest first</p>
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {tickets.items.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-zinc-400">{ticket.code}</span>
                  <p className="truncate text-zinc-900">{ticket.subject}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">
                  <p>{ticket.status}</p>
                  <p>{ticket.priority}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}