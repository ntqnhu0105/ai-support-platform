import { describe, expect, it } from 'vitest';
import { assigneeIdsIn } from './audit-diff.js';

describe('assigneeIdsIn', () => {
  it('returns both people of an assignment change', () => {
    expect(assigneeIdsIn({ assigneeId: { from: 'a', to: 'b' } })).toEqual(['a', 'b']);
  });

  it('skips the empty side of the change', () => {
    expect(assigneeIdsIn({ assigneeId: { from: null, to: 'b' } })).toEqual(['b']);
    expect(assigneeIdsIn({ assigneeId: { from: 'a', to: null } })).toEqual(['a']);
  });

  it('ignores entries that are not about assignment', () => {
    expect(assigneeIdsIn({ status: { from: 'OPEN', to: 'CLOSED' } })).toEqual([]);
  });

  it('copes with a missing or malformed diff', () => {
    expect(assigneeIdsIn(null)).toEqual([]);
    expect(assigneeIdsIn(undefined)).toEqual([]);
    expect(assigneeIdsIn('text')).toEqual([]);
    expect(assigneeIdsIn({ assigneeId: 'not-an-object' })).toEqual([]);
  });

  it('ignores values that are not strings', () => {
    expect(assigneeIdsIn({ assigneeId: { from: 1, to: { x: 1 } } })).toEqual([]);
  });
});