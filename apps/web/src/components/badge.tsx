import type { TicketPriority, TicketStatus } from '@/lib/ticket-filters';

export function formatLabel(value: string): string {
  const text = value.replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  WAITING_CUSTOMER: 'bg-purple-50 text-purple-700',
  RESOLVED: 'bg-green-50 text-green-700',
  CLOSED: 'bg-zinc-100 text-zinc-600',
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'bg-zinc-100 text-zinc-600',
  MEDIUM: 'bg-sky-50 text-sky-700',
  HIGH: 'bg-orange-50 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const BASE = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${BASE} ${STATUS_STYLES[status]}`}>{formatLabel(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`${BASE} ${PRIORITY_STYLES[priority]}`}>{formatLabel(priority)}</span>;
}