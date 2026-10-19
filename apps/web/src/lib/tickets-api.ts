import { apiFetch, type Role } from './api';
import {
  toApiQuery,
  type TicketFilters,
  type TicketPriority,
  type TicketStatus,
} from './ticket-filters';
import type { HistoryEntry } from './history';

export interface TicketSummary {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  customerId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketPage {
  items: TicketSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchTickets(filters: TicketFilters): Promise<TicketPage> {
  const result = await apiFetch<TicketPage>(`/tickets?${toApiQuery(filters)}`);

  console.log('[E2E] GET /tickets:', {
    filters,
    total: result.meta.total,
    totalPages: result.meta.totalPages,
    items: result.items.length,
  });

  return result;
}

export interface Person {
  id: string;
  name: string | null;
}

export interface TicketDetail extends TicketSummary {
  body: string;
  customer: Person;
  assignee: Person | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string | null; role: Role };
  createdAt: string;
}

export const fetchTicket = (id: string) => apiFetch<TicketDetail>(`/tickets/${id}`);

export const fetchComments = (id: string) =>
  apiFetch<TicketComment[]>(`/tickets/${id}/comments`);

export const createTicket = (input: { subject: string; body: string }) =>
  apiFetch<{ id: string; code: string }>('/tickets', {
    method: 'POST',
    body: JSON.stringify({ subject: input.subject.trim(), body: input.body.trim() }),
  });

export const postComment = (ticketId: string, input: { body: string; isInternal: boolean }) =>
  apiFetch<TicketComment>(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const changeStatus = (id: string, status: TicketStatus) =>
  apiFetch<{ id: string }>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const assignTicket = (id: string, assigneeId?: string) =>
  apiFetch<{ id: string }>(`/tickets/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(assigneeId ? { assigneeId } : {}),
  });

export const unassignTicket = (id: string) =>
  apiFetch<{ id: string }>(`/tickets/${id}/unassign`, { method: 'POST', body: '{}' });

export const fetchHistory = (id: string) => apiFetch<HistoryEntry[]>(`/tickets/${id}/history`);

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export const fetchUsers = () => apiFetch<AdminUser[]>('/users');