import type { Ticket } from '../generated/prisma/client.js';

export function formatTicketCode(number: number): string {
  return `TCK-${String(number).padStart(4, '0')}`;
}

export function toTicketResponse(ticket: Ticket) {
  return {
    id: ticket.id,
    code: formatTicketCode(ticket.number),
    subject: ticket.subject,
    body: ticket.body,
    status: ticket.status,
    priority: ticket.priority,
    customerId: ticket.customerId,
    assigneeId: ticket.assigneeId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
export function toTicketSummary(ticket: Ticket) {
  return {
    id: ticket.id,
    code: formatTicketCode(ticket.number),
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    customerId: ticket.customerId,
    assigneeId: ticket.assigneeId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
export interface PersonRef {
  id: string;
  name: string | null;
}

export type TicketWithPeople = Ticket & { customer: PersonRef; assignee: PersonRef | null };

export function toTicketDetail(ticket: TicketWithPeople) {
  return {
    ...toTicketResponse(ticket),
    customer: { id: ticket.customer.id, name: ticket.customer.name },
    assignee: ticket.assignee
      ? { id: ticket.assignee.id, name: ticket.assignee.name }
      : null,
  };
}