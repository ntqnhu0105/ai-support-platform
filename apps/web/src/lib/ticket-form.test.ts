import { describe, expect, it } from 'vitest';
import {
  BODY_MAX,
  BODY_MIN,
  COMMENT_MAX,
  SUBJECT_MAX,
  SUBJECT_MIN,
  validateComment,
  validateTicketInput,
} from './ticket-form';

const valid = { subject: 'Cannot withdraw money', body: 'My withdrawal has been pending for days.' };

describe('validateTicketInput', () => {
  it('accepts a valid ticket', () => {
    expect(validateTicketInput(valid)).toEqual({});
  });

  it('rejects a subject that is too short', () => {
    expect(validateTicketInput({ ...valid, subject: 'Hi' }).subject).toContain('at least');
  });

  it('rejects a description that is too short', () => {
    expect(validateTicketInput({ ...valid, body: 'Too short' }).body).toContain('at least');
  });

  it('measures the trimmed text, so spaces do not count', () => {
    const errors = validateTicketInput({ subject: '     Hi     ', body: '          a          ' });

    expect(errors.subject).toBeDefined();
    expect(errors.body).toBeDefined();
  });

  it('rejects text over the limits', () => {
    const errors = validateTicketInput({
      subject: 'a'.repeat(SUBJECT_MAX + 1),
      body: 'b'.repeat(BODY_MAX + 1),
    });

    expect(errors.subject).toContain('at most');
    expect(errors.body).toContain('at most');
  });

  it('reports every problem at once', () => {
    expect(Object.keys(validateTicketInput({ subject: '', body: '' })).sort()).toEqual([
      'body',
      'subject',
    ]);
  });

  it('accepts text exactly at the limits', () => {
    expect(
      validateTicketInput({ subject: 'a'.repeat(SUBJECT_MIN), body: 'b'.repeat(BODY_MIN) }),
    ).toEqual({});
    expect(
      validateTicketInput({ subject: 'a'.repeat(SUBJECT_MAX), body: 'b'.repeat(BODY_MAX) }),
    ).toEqual({});
  });
});

describe('validateComment', () => {
  it('rejects empty or whitespace-only text', () => {
    expect(validateComment('')).not.toBeNull();
    expect(validateComment('     ')).not.toBeNull();
  });

  it('rejects text over the limit', () => {
    expect(validateComment('a'.repeat(COMMENT_MAX + 1))).toContain('at most');
  });

  it('accepts normal text, including text exactly at the limit', () => {
    expect(validateComment('Thanks, that fixed it')).toBeNull();
    expect(validateComment('a'.repeat(COMMENT_MAX))).toBeNull();
  });
});