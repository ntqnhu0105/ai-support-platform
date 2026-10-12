'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import {
  BODY_MAX,
  SUBJECT_MAX,
  validateTicketInput,
  type TicketInputErrors,
} from '@/lib/ticket-form';
import { createTicket } from '@/lib/tickets-api';
import { useRequireSession } from '@/lib/use-session-guard';

const inputClass =
  'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500';

export default function NewTicketPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state } = useRequireSession();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<TicketInputErrors>({});

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      router.push(`/tickets/${ticket.id}`);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateTicketInput({ subject, body });
    setErrors(found);
    if (Object.keys(found).length === 0) mutation.mutate({ subject, body });
  }

  if (state.status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading...
      </main>
    );
  }

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Cannot reach the server. Please try again.'
        : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/tickets" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Back to tickets
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900">New ticket</h1>
      <p className="text-sm text-zinc-500">Describe your problem and our team will get back to you.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={SUBJECT_MAX + 50}
            aria-invalid={Boolean(errors.subject)}
            className={inputClass}
          />
          {errors.subject && <span className="mt-1 block text-red-600">{errors.subject}</span>}
        </label>

        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Description</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={BODY_MAX + 500}
            aria-invalid={Boolean(errors.body)}
            className={inputClass}
          />
          {errors.body && <span className="mt-1 block text-red-600">{errors.body}</span>}
        </label>

        {serverError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Sending...' : 'Submit ticket'}
        </button>
      </form>
    </main>
  );
}