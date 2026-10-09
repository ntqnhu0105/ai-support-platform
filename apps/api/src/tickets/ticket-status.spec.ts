import type { TicketStatus } from '../generated/prisma/client.js';
import { canTransition } from './tickets-status.js';

const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];

// Written out by hand on purpose: it is an independent copy of the rules.
const ALLOWED = new Set([
  'OPEN>IN_PROGRESS',
  'OPEN>CLOSED',
  'IN_PROGRESS>WAITING_CUSTOMER',
  'IN_PROGRESS>RESOLVED',
  'WAITING_CUSTOMER>IN_PROGRESS',
  'WAITING_CUSTOMER>CLOSED',
  'RESOLVED>CLOSED',
  'RESOLVED>IN_PROGRESS',
]);

const pairs: [TicketStatus, TicketStatus][] = STATUSES.flatMap((from) =>
  STATUSES.map((to): [TicketStatus, TicketStatus] => [from, to]),
);

describe('canTransition', () => {
  it.each(pairs)('%s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(ALLOWED.has(`${from}>${to}`));
  });

  it('never allows leaving CLOSED', () => {
    for (const to of STATUSES) {
      expect(canTransition('CLOSED', to)).toBe(false);
    }
  });
});