'use client';

import { useEffect, useState } from 'react';

type Health = { status: string; db: string; time: string };
type State = 'loading' | 'ok' | 'down';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function Home() {
  const [state, setState] = useState<State>('loading');
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setHealth((await res.json()) as Health);
        setState('ok');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('down');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Support Platform</h1>
        <p className="mt-1 text-sm text-zinc-500">Connection check</p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">API</dt>
            <dd className="font-medium">
              {state === 'loading' && <span className="text-zinc-400">checking...</span>}
              {state === 'ok' && <span className="text-green-600">online</span>}
              {state === 'down' && <span className="text-red-600">unreachable</span>}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Database</dt>
            <dd className="font-medium">
              {state === 'ok' ? (
                <span className="text-green-600">{health?.db}</span>
              ) : (
                <span className="text-zinc-400">-</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">API address</dt>
            <dd className="font-mono text-xs text-zinc-700">{API_URL}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}