/** Ids of the people named in an assignment audit entry, i.e. { assigneeId: { from, to } }. */
export function assigneeIdsIn(diff: unknown): string[] {
  if (typeof diff !== 'object' || diff === null) return [];

  const change = (diff as { assigneeId?: unknown }).assigneeId;
  if (typeof change !== 'object' || change === null) return [];

  const { from, to } = change as { from?: unknown; to?: unknown };
  return [from, to].filter((value): value is string => typeof value === 'string');
}