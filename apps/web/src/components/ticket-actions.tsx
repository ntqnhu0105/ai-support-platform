'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type AuthUser } from '@/lib/api';
import { formatLabel } from '@/lib/format';
import type { TicketStatus } from '@/lib/ticket-filters';
import {
  STATUS_ACTION_LABELS,
  canAssignToOthers,
  canRelease,
  canTake,
  nextStatuses,
} from '@/lib/ticket-workflow';
import {
  assignTicket,
  changeStatus,
  fetchUsers,
  unassignTicket,
  type TicketDetail,
} from '@/lib/tickets-api';

type Action =
  | { type: 'status'; status: TicketStatus }
  | { type: 'take' }
  | { type: 'release' }
  | { type: 'assign'; assigneeId: string };

const buttonClass =
  'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50';

export function TicketActions({ ticket, viewer }: { ticket: TicketDetail; viewer: AuthUser }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (action: Action) => {
      switch (action.type) {
        case 'status':
          return changeStatus(ticket.id, action.status);
        case 'take':
          return assignTicket(ticket.id);
        case 'release':
          return unassignTicket(ticket.id);
        case 'assign':
          return assignTicket(ticket.id, action.assigneeId);
      }
    },
    // Refresh whatever the outcome: after a refusal (409) the screen must show what really changed.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['history', ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  });

  const state = { status: ticket.status, assigneeId: ticket.assignee?.id ?? null };
  const assignToOthers = canAssignToOthers(viewer, state);
  const statuses = nextStatuses(ticket.status);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: assignToOthers,
  });
  const assignees = (usersQuery.data ?? []).filter(
    (user) => user.role !== 'CUSTOMER' && user.isActive && user.id !== state.assigneeId,
  );

  function onStatus(status: TicketStatus) {
    if (
      status === 'CLOSED' &&
      !window.confirm('Close this ticket? A closed ticket cannot be reopened.')
    ) {
      return;
    }
    mutation.mutate({ type: 'status', status });
  }

  const errorMessage = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : 'Cannot reach the server. Please try again.'
    : null;

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4" aria-label="Actions">
      <h2 className="text-sm font-semibold text-zinc-900">Actions</h2>

      {ticket.status === 'CLOSED' ? (
        <p className="mt-2 text-sm text-zinc-500">A closed ticket cannot be changed.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canTake(viewer, state) && (
            <button
              onClick={() => mutation.mutate({ type: 'take' })}
              disabled={mutation.isPending}
              className={buttonClass}
            >
              Take ticket
            </button>
          )}
          {canRelease(viewer, state) && (
            <button
              onClick={() => mutation.mutate({ type: 'release' })}
              disabled={mutation.isPending}
              className={buttonClass}
            >
              Release
            </button>
          )}
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => onStatus(status)}
              disabled={mutation.isPending}
              className={buttonClass}
            >
              {STATUS_ACTION_LABELS[status]}
            </button>
          ))}

          {assignToOthers && (
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <span>Assign to</span>
              <select
                value=""
                disabled={mutation.isPending || usersQuery.isPending}
                onChange={(e) => {
                  if (e.target.value) {
                    mutation.mutate({ type: 'assign', assigneeId: e.target.value });
                  }
                }}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Choose a person...</option>
                {assignees.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.email} ({formatLabel(user.role)})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </section>
  );
}