import { describe, expect, it } from 'vitest';
import {
  STATUS_TRANSITIONS,
  canAssignToOthers,
  canRelease,
  canTake,
  nextStatuses,
} from './ticket-workflow';

const agent = { id: 'agent-1', role: 'AGENT' } as const;
const otherAgent = { id: 'agent-2', role: 'AGENT' } as const;
const admin = { id: 'admin-1', role: 'ADMIN' } as const;
const customer = { id: 'customer-1', role: 'CUSTOMER' } as const;

const unassigned = { status: 'OPEN', assigneeId: null } as const;
const mine = { status: 'IN_PROGRESS', assigneeId: agent.id } as const;
const theirs = { status: 'IN_PROGRESS', assigneeId: otherAgent.id } as const;
const closed = { status: 'CLOSED', assigneeId: agent.id } as const;

describe('nextStatuses', () => {
  it('offers only the moves the API allows', () => {
    expect(nextStatuses('OPEN')).toEqual(['IN_PROGRESS', 'CLOSED']);
    expect(nextStatuses('IN_PROGRESS')).toEqual(['WAITING_CUSTOMER', 'RESOLVED']);
  });

  it('offers nothing once a ticket is closed', () => {
    expect(nextStatuses('CLOSED')).toEqual([]);
  });

  it('only ever points to statuses that exist', () => {
    const known = Object.keys(STATUS_TRANSITIONS);
    for (const targets of Object.values(STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(known).toContain(target);
      }
    }
  });
});

describe('canTake', () => {
  it('is never offered to a customer', () => {
    expect(canTake(customer, unassigned)).toBe(false);
  });

  it('lets an agent take an unassigned ticket', () => {
    expect(canTake(agent, unassigned)).toBe(true);
  });

  it("does not let an agent take another agent's ticket", () => {
    expect(canTake(agent, theirs)).toBe(false);
  });

  it('does not offer a ticket that is already mine', () => {
    expect(canTake(agent, mine)).toBe(false);
  });

  it("lets an admin take over another agent's ticket", () => {
    expect(canTake(admin, theirs)).toBe(true);
  });

  it('is never offered on a closed ticket', () => {
    expect(canTake(admin, { status: 'CLOSED', assigneeId: null })).toBe(false);
  });
});

describe('canRelease', () => {
  it('lets an agent release their own ticket only', () => {
    expect(canRelease(agent, mine)).toBe(true);
    expect(canRelease(agent, theirs)).toBe(false);
  });

  it('lets an admin release anyone', () => {
    expect(canRelease(admin, theirs)).toBe(true);
  });

  it('is not offered for an unassigned or closed ticket, nor to a customer', () => {
    expect(canRelease(admin, unassigned)).toBe(false);
    expect(canRelease(agent, closed)).toBe(false);
    expect(canRelease(customer, mine)).toBe(false);
  });
});

describe('canAssignToOthers', () => {
  it('is for admins on tickets that are not closed', () => {
    expect(canAssignToOthers(admin, unassigned)).toBe(true);
    expect(canAssignToOthers(admin, closed)).toBe(false);
    expect(canAssignToOthers(agent, unassigned)).toBe(false);
  });
});