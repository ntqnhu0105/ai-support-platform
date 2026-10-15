import { formatLabel } from './format';

export interface HistoryActor {
  id: string;
  name: string | null;
  role: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  actorId: string | null;
  actor: HistoryActor | null;
  diff: unknown;
  people: Record<string, string | null>;
  createdAt: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** Turns one audit entry into a sentence. Never throws, whatever the stored diff looks like. */
export function describeHistoryEntry(entry: HistoryEntry): string {
  const who = entry.actor ? (entry.actor.name ?? 'An unnamed user') : 'Someone';
  const diff = asRecord(entry.diff);
  const nameOf = (id: string) => entry.people[id] ?? 'an unnamed user';

  switch (entry.action) {
    case 'ticket.created':
      return `${who} created the ticket`;

    case 'ticket.status_changed': {
      const change = asRecord(diff.status);
      const from = asString(change.from);
      const to = asString(change.to);
      if (!from || !to) return `${who} changed the status`;
      const reason = diff.reason === 'customer_reply' ? ' because the customer replied' : '';
      return `${who} changed the status from ${formatLabel(from)} to ${formatLabel(to)}${reason}`;
    }

    case 'ticket.assigned': {
      const to = asString(asRecord(diff.assigneeId).to);
      if (!to || to === entry.actorId) return `${who} took the ticket`;
      return `${who} assigned the ticket to ${nameOf(to)}`;
    }

    case 'ticket.unassigned': {
      const from = asString(asRecord(diff.assigneeId).from);
      if (!from || from === entry.actorId) return `${who} released the ticket`;
      return `${who} removed ${nameOf(from)} from the ticket`;
    }

    default:
      return `${who} made a change (${entry.action})`;
  }
}