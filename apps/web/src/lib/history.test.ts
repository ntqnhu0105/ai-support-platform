import { describe, expect, it } from 'vitest';
import { describeHistoryEntry, type HistoryEntry } from './history';

const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'e1',
  action: 'ticket.created',
  actorId: 'u1',
  actor: { id: 'u1', name: 'Sam Support', role: 'AGENT' },
  diff: {},
  people: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('describeHistoryEntry', () => {
  it('describes the creation of a ticket', () => {
    expect(describeHistoryEntry(entry({ action: 'ticket.created' }))).toBe(
      'Sam Support created the ticket',
    );
  });

  it('describes a status change with readable labels', () => {
    const text = describeHistoryEntry(
      entry({
        action: 'ticket.status_changed',
        diff: { status: { from: 'OPEN', to: 'IN_PROGRESS' } },
      }),
    );

    expect(text).toBe('Sam Support changed the status from Open to In progress');
  });

  it('says when the customer reply caused a status change', () => {
    const text = describeHistoryEntry(
      entry({
        action: 'ticket.status_changed',
        diff: {
          status: { from: 'WAITING_CUSTOMER', to: 'IN_PROGRESS' },
          reason: 'customer_reply',
        },
      }),
    );

    expect(text).toContain('because the customer replied');
  });

  it('says the person took the ticket when they assigned it to themselves', () => {
    const text = describeHistoryEntry(
      entry({ action: 'ticket.assigned', diff: { assigneeId: { from: null, to: 'u1' } } }),
    );

    expect(text).toBe('Sam Support took the ticket');
  });

  it('names the person when someone else is assigned', () => {
    const text = describeHistoryEntry(
      entry({
        action: 'ticket.assigned',
        diff: { assigneeId: { from: null, to: 'u2' } },
        people: { u2: 'Dana Support' },
      }),
    );

    expect(text).toBe('Sam Support assigned the ticket to Dana Support');
  });

  it('tells releasing your own ticket apart from removing someone else', () => {
    const released = describeHistoryEntry(
      entry({ action: 'ticket.unassigned', diff: { assigneeId: { from: 'u1', to: null } } }),
    );
    const removed = describeHistoryEntry(
      entry({
        action: 'ticket.unassigned',
        diff: { assigneeId: { from: 'u2', to: null } },
        people: { u2: 'Dana Support' },
      }),
    );

    expect(released).toBe('Sam Support released the ticket');
    expect(removed).toBe('Sam Support removed Dana Support from the ticket');
  });

  it('copes with an actor that no longer exists or has no name', () => {
    expect(describeHistoryEntry(entry({ actor: null, actorId: null }))).toBe(
      'Someone created the ticket',
    );
    expect(
      describeHistoryEntry(entry({ actor: { id: 'u1', name: null, role: 'AGENT' } })),
    ).toBe('An unnamed user created the ticket');
  });

  it('never throws on unknown actions or malformed data', () => {
    expect(describeHistoryEntry(entry({ action: 'ticket.exploded' }))).toContain('ticket.exploded');
    expect(describeHistoryEntry(entry({ action: 'ticket.status_changed', diff: null }))).toBe(
      'Sam Support changed the status',
    );
    expect(describeHistoryEntry(entry({ action: 'ticket.assigned', diff: 'oops' }))).toBe(
      'Sam Support took the ticket',
    );
  });
});