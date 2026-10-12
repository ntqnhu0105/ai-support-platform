// These limits mirror the API rules. The server stays the real authority:
// this file only gives the user instant feedback before the request is sent.
export const SUBJECT_MIN = 5;
export const SUBJECT_MAX = 200;
export const BODY_MIN = 10;
export const BODY_MAX = 5000;
export const COMMENT_MAX = 5000;

export interface TicketInput {
  subject: string;
  body: string;
}

export type TicketInputErrors = Partial<Record<keyof TicketInput, string>>;

export function validateTicketInput(input: TicketInput): TicketInputErrors {
  const errors: TicketInputErrors = {};
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (subject.length < SUBJECT_MIN) {
    errors.subject = `Subject must be at least ${SUBJECT_MIN} characters`;
  } else if (subject.length > SUBJECT_MAX) {
    errors.subject = `Subject must be at most ${SUBJECT_MAX} characters`;
  }

  if (body.length < BODY_MIN) {
    errors.body = `Description must be at least ${BODY_MIN} characters`;
  } else if (body.length > BODY_MAX) {
    errors.body = `Description must be at most ${BODY_MAX} characters`;
  }

  return errors;
}

/** Returns an error message, or null when the reply can be sent. */
export function validateComment(body: string): string | null {
  const text = body.trim();
  if (text.length === 0) return 'Write something before sending';
  if (text.length > COMMENT_MAX) return `Reply must be at most ${COMMENT_MAX} characters`;
  return null;
}