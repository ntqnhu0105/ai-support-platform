import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { recordAudit } from '../audit/audit.js';
import type { JwtPayload } from '../auth/auth.types.js';
import type { Ticket } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toCommentResponse } from './comment.mapper.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import { canViewTicket } from './ticket-access.js';

const authorSelect = { id: true, name: true, role: true } as const;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: JwtPayload, ticketId: string, dto: CreateCommentDto) {
    const ticket = await this.requireVisibleTicket(user, ticketId);
    const isStaff = user.role !== 'CUSTOMER';
    const isInternal = dto.isInternal ?? false;

    if (isInternal && !isStaff) {
      throw new ForbiddenException('Customers cannot post internal notes');
    }
    if (ticket.status === 'CLOSED') {
      throw new ConflictException('Closed tickets cannot receive new comments');
    }

    // A customer reply hands the ticket back to the agents.
    const reopens =
      !isStaff && (ticket.status === 'WAITING_CUSTOMER' || ticket.status === 'RESOLVED');

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticketComment.create({
        data: { ticketId, authorId: user.sub, body: dto.body, isInternal },
        include: { author: { select: authorSelect } },
      });

      if (reopens) {
        // Only if nobody changed the status in the meantime; the comment is kept either way.
        const result = await tx.ticket.updateMany({
          where: { id: ticketId, status: ticket.status },
          data: { status: 'IN_PROGRESS' },
        });
        if (result.count === 1) {
          await recordAudit(tx, {
            actorId: user.sub,
            entity: 'ticket',
            entityId: ticketId,
            action: 'ticket.status_changed',
            diff: {
              status: { from: ticket.status, to: 'IN_PROGRESS' },
              reason: 'customer_reply',
            },
          });
        }
      }
      return created;
    });

    return toCommentResponse(comment);
  }

  async list(user: JwtPayload, ticketId: string) {
    await this.requireVisibleTicket(user, ticketId);

    const comments = await this.prisma.ticketComment.findMany({
      where: {
        ticketId,
        // Internal notes never reach customers.
        ...(user.role === 'CUSTOMER' ? { isInternal: false } : {}),
      },
      include: { author: { select: authorSelect } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return comments.map(toCommentResponse);
  }

  private async requireVisibleTicket(user: JwtPayload, ticketId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || !canViewTicket(user, ticket)) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }
}