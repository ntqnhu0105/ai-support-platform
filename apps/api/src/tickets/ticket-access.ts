import type { JwtPayload } from '../auth/auth.types.js';
import type { Ticket } from '../generated/prisma/client.js';

/** Staff see every ticket; a customer only sees their own. */
export function canViewTicket(user: JwtPayload, ticket: Ticket): boolean {
  return user.role !== 'CUSTOMER' || ticket.customerId === user.sub;
}