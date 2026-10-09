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