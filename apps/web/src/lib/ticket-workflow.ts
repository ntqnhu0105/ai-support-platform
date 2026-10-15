import type { Role } from './api';
import type { TicketStatus } from './ticket-filters';

// Mirrors the API's status rules. The server stays the real authority: this table only
// decides which buttons to show, so a user is never offered a move the server will refuse.
export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'RESOLVED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export const STATUS_ACTION_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Mark as open',
  IN_PROGRESS: 'Mark as in progress',
  WAITING_CUSTOMER: 'Wait for customer',
  RESOLVED: 'Mark as resolved',
  CLOSED: 'Close ticket',
};

export function nextStatuses(status: TicketStatus): readonly TicketStatus[] {
  return STATUS_TRANSITIONS[status];
}

export interface Viewer {
  id: string;
  role: Role;
}

export interface AssignmentState {
  status: TicketStatus;
  assigneeId: string | null;
}

/** An agent may take only an unassigned ticket; an admin may take any open ticket. */
export function canTake(viewer: Viewer, ticket: AssignmentState): boolean {
  if (viewer.role === 'CUSTOMER') return false;
  if (ticket.status === 'CLOSED') return false;
  if (ticket.assigneeId === viewer.id) return false;
  return ticket.assigneeId === null || viewer.role === 'ADMIN';
}

/** An agent may release only their own ticket; an admin may release anyone's. */
export function canRelease(viewer: Viewer, ticket: AssignmentState): boolean {
  if (viewer.role === 'CUSTOMER') return false;
  if (ticket.status === 'CLOSED') return false;
  if (ticket.assigneeId === null) return false;
  return viewer.role === 'ADMIN' || ticket.assigneeId === viewer.id;
}

export function canAssignToOthers(viewer: Viewer, ticket: AssignmentState): boolean {
  return viewer.role === 'ADMIN' && ticket.status !== 'CLOSED';
}