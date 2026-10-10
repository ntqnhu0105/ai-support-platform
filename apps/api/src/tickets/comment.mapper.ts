import type { Role, TicketComment } from '../generated/prisma/client.js';

export interface CommentAuthor {
  id: string;
  name: string | null;
  role: Role;
}

export type CommentWithAuthor = TicketComment & { author: CommentAuthor };

export function toCommentResponse(comment: CommentWithAuthor) {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    body: comment.body,
    isInternal: comment.isInternal,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      role: comment.author.role,
    },
    createdAt: comment.createdAt,
  };
}