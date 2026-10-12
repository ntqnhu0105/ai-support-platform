import { Suspense } from 'react';
import { TicketsView } from './tickets-view';

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Loading...
        </main>
      }
    >
      <TicketsView />
    </Suspense>
  );
}