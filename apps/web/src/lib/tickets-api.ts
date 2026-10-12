import { apiFetch, type Role } from './api';
import {
  toApiQuery,
  type TicketFilters,
  type TicketPriority,
  type TicketStatus,
} from './ticket-filters';

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

export function fetchTickets(filters: TicketFilters): Promise<TicketPage> {
  return apiFetch<TicketPage>(`/tickets?${toApiQuery(filters)}`);
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