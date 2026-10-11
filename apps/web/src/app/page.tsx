'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/tickets');
    if (state.status === 'anonymous') router.replace('/login');
  }, [state.status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
      Loading...
    </main>
  );
}