import { apiFetch } from './api';
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