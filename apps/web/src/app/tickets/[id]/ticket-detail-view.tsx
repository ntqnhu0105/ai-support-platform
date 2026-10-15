'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PriorityBadge, StatusBadge } from '@/components/badge';
import { ApiError } from '@/lib/api';
import { displayName, formatDateTime, formatLabel } from '@/lib/format';
import { COMMENT_MAX, validateComment } from '@/lib/ticket-form';
import {
  fetchComments,
  fetchTicket,
  postComment,
  type TicketComment,
} from '@/lib/tickets-api';
import { useRedirectWhenSessionExpires, useRequireSession } from '@/lib/use-session-guard';
import { TicketActions } from '@/components/ticket-actions';
import { TicketHistory } from '@/components/ticket-history';

export function TicketDetailView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { state } = useRequireSession();
  const authenticated = state.status === 'authenticated';

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id),
    enabled: authenticated,
  });
  const commentsQuery = useQuery({
    queryKey: ['comments', id],
    queryFn: () => fetchComments(id),
    enabled: authenticated,
  });
  useRedirectWhenSessionExpires(ticketQuery.error ?? commentsQuery.error);

  function goBack() {
    // Going back keeps the filters of the list; a direct visit has nowhere to go back to.
    if (window.history.length > 1) router.back();
    else router.push('/tickets');
  }

  if (state.status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading...
      </main>
    );
  }

  const isStaff = state.user.role !== 'CUSTOMER';
  const ticket = ticketQuery.data;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <button onClick={goBack} className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Back
      </button>

      {ticketQuery.isError ? (
        <TicketError error={ticketQuery.error} onRetry={() => void ticketQuery.refetch()} />
      ) : !ticket ? (
        <div className="mt-4 space-y-3" aria-label="Loading ticket">
          <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-100" />
          <div className="h-32 animate-pulse rounded bg-zinc-100" />
        </div>
      ) : (
        <>
          <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-5">
            <p className="font-mono text-xs text-zinc-400">{ticket.code}</p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900">{ticket.subject}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500">Customer</dt>
                <dd className="text-zinc-900">{displayName(ticket.customer)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Assigned to</dt>
                <dd className="text-zinc-900">
                  {ticket.assignee ? displayName(ticket.assignee) : 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Created</dt>
                <dd className="text-zinc-900">{formatDateTime(ticket.createdAt)}</dd>
              </div>
            </dl>
            <p className="mt-4 whitespace-pre-wrap-break-words text-sm text-zinc-800">
              {ticket.body}
            </p>
          </section>
              {isStaff && <TicketActions ticket={ticket} viewer={state.user} />}
        
          <section className="mt-6" aria-label="Conversation">
            <h2 className="text-sm font-semibold text-zinc-900">Conversation</h2>
            <Conversation
              isPending={commentsQuery.isPending}
              error={commentsQuery.error}
              comments={commentsQuery.data}
              onRetry={() => void commentsQuery.refetch()}
            />
          </section>
          

          <section className="mt-6">
            {ticket.status === 'CLOSED' ? (
              <p className="rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
                This ticket is closed, so it no longer accepts replies.
              </p>
            ) : (
              <ReplyBox ticketId={ticket.id} isStaff={isStaff} />
            )}
          </section>
              {isStaff && <TicketHistory ticketId={ticket.id} />}
        </>
      )}
    </main>
  );
}

function TicketError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // An id that is not a UUID (400) is just another way of asking for a ticket that is not there.
  const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);

  return (
    <div role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
      <p>
        {notFound
          ? 'Ticket not found.'
          : error instanceof ApiError
            ? error.message
            : 'Could not load the ticket.'}
      </p>
      {!notFound && (
        <button onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

function Conversation({
  isPending,
  error,
  comments,
  onRetry,
}: {
  isPending: boolean;
  error: unknown;
  comments: TicketComment[] | undefined;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div role="alert" className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        <p>{error instanceof ApiError ? error.message : 'Could not load the conversation.'}</p>
        <button onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      </div>
    );
  }
  if (isPending) {
    return <p className="mt-3 text-sm text-zinc-500">Loading conversation...</p>;
  }
  if (!comments || comments.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">No replies yet.</p>;
  }

  return (
    <ul className="mt-3 space-y-3">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className={
            comment.isInternal
              ? 'rounded-lg border border-amber-300 bg-amber-50 p-4'
              : 'rounded-lg border border-zinc-200 bg-white p-4'
          }
        >
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-800">{displayName(comment.author)}</span>
            <span>{formatLabel(comment.author.role)}</span>
            <span>&middot;</span>
            <span>{formatDateTime(comment.createdAt)}</span>
            {comment.isInternal && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-900">
                Internal note
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap-break-words text-sm text-zinc-800">
            {comment.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ReplyBox({ ticketId, isStaff }: { ticketId: string; isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => postComment(ticketId, { body: text.trim(), isInternal: internal }),
    onSuccess: async () => {
      setText('');
      // A customer reply can also change the ticket status, so refresh the ticket and the lists.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['comments', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateComment(text);
    setProblem(found);
    if (!found) mutation.mutate();
  }

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Cannot reach the server. Please try again.'
        : null;
  const message = problem ?? serverError;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">
          {internal ? 'Internal note (the customer will not see this)' : 'Reply'}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={COMMENT_MAX + 500}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 ${
            internal ? 'border-amber-300 bg-amber-50' : 'border-zinc-300'
          }`}
        />
      </label>

      {isStaff && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
          />
          Internal note, hidden from the customer
        </label>
      )}

      {message && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {mutation.isPending ? 'Sending...' : internal ? 'Add note' : 'Send reply'}
      </button>
    </form>
  );
}