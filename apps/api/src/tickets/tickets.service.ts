import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { recordAudit } from '../audit/audit.js';
import type { JwtPayload } from '../auth/auth.types.js';
import type { Prisma, Ticket } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignTicketDto } from './dto/assign-ticket.dto.js';
import type { ChangeStatusDto } from './dto/change-status.dto.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import type { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { canTransition } from './tickets-status.js';
import { toTicketResponse, toTicketSummary } from './ticket.mapper.js';

const CONCURRENT_UPDATE = 'The ticket was changed by someone else, please reload and retry';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: JwtPayload, dto: CreateTicketDto) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: { subject: dto.subject, body: dto.body, customerId: user.sub },
      });
      await recordAudit(tx, {
        actorId: user.sub,
        entity: 'ticket',
        entityId: created.id,
        action: 'ticket.created',
        diff: { subject: created.subject },
      });
      return created;
    });
    return toTicketResponse(ticket);
  }

  async list(user: JwtPayload, query: ListTicketsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const filters: Prisma.TicketWhereInput[] = [];

    // Access scope comes first and is decided by the server, never by the client.
    if (user.role === 'CUSTOMER') filters.push({ customerId: user.sub });

    if (query.status) filters.push({ status: query.status });
    if (query.priority) filters.push({ priority: query.priority });
    if (query.assigneeId) filters.push({ assigneeId: query.assigneeId });

    if (query.q) {
      const codeNumber = /^TCK-(\d{1,9})$/i.exec(query.q)?.[1];
      filters.push({
        OR: [
          { subject: { contains: query.q, mode: 'insensitive' } },
          { body: { contains: query.q, mode: 'insensitive' } },
          ...(codeNumber ? [{ number: Number(codeNumber) }] : []),
        ],
      });
    }

    const where: Prisma.TicketWhereInput = { AND: filters };

    // The trailing { id } makes the order deterministic, so pages never overlap.
    const orderBy: Prisma.TicketOrderByWithRelationInput[] =
      query.sort === 'priority'
        ? [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }]
        : query.sort === 'oldest'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }];

    const [total, tickets] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: tickets.map(toTicketSummary),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(user: JwtPayload, id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });

    // Customers only see their own tickets. For anything else answer 404, not 403,
    // so the API never confirms that someone else's ticket exists.
    const allowed = ticket && (user.role !== 'CUSTOMER' || ticket.customerId === user.sub);
    if (!ticket || !allowed) {
      throw new NotFoundException('Ticket not found');
    }
    return toTicketResponse(ticket);
  }

  async changeStatus(user: JwtPayload, id: string, dto: ChangeStatusDto) {
    const ticket = await this.requireTicket(id);

    if (!canTransition(ticket.status, dto.status)) {
      throw new ConflictException(`Cannot change status from ${ticket.status} to ${dto.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Only succeeds if nobody changed the status since we read it.
      const result = await tx.ticket.updateMany({
        where: { id, status: ticket.status },
        data: { status: dto.status },
      });
      if (result.count === 0) throw new ConflictException(CONCURRENT_UPDATE);

      await recordAudit(tx, {
        actorId: user.sub,
        entity: 'ticket',
        entityId: id,
        action: 'ticket.status_changed',
        diff: { status: { from: ticket.status, to: dto.status } },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id } });
    });
    return toTicketResponse(updated);
  }

  async assign(user: JwtPayload, id: string, dto: AssignTicketDto) {
    const assigneeId = dto.assigneeId ?? user.sub;

    if (user.role !== 'ADMIN' && assigneeId !== user.sub) {
      throw new ForbiddenException('Agents can only assign tickets to themselves');
    }

    const ticket = await this.requireTicket(id);

    if (ticket.status === 'CLOSED') {
      throw new ConflictException('Closed tickets cannot be assigned');
    }
    if (ticket.assigneeId === assigneeId) {
      return toTicketResponse(ticket); // already assigned to this person: nothing to do
    }
    if (user.role !== 'ADMIN' && ticket.assigneeId !== null) {
      throw new ConflictException('Ticket is already assigned to another agent');
    }

    if (assigneeId !== user.sub) {
      const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || !assignee.isActive || assignee.role === 'CUSTOMER') {
        throw new BadRequestException('Assignee must be an active agent or admin');
      }
    }

    return this.changeAssignee(user, ticket, assigneeId);
  }

  async unassign(user: JwtPayload, id: string) {
    const ticket = await this.requireTicket(id);

    if (ticket.assigneeId === null) {
      return toTicketResponse(ticket); // nothing to release
    }
    if (user.role !== 'ADMIN' && ticket.assigneeId !== user.sub) {
      throw new ForbiddenException('You can only release tickets assigned to you');
    }
    if (ticket.status === 'CLOSED') {
      throw new ConflictException('Closed tickets cannot be changed');
    }

    return this.changeAssignee(user, ticket, null);
  }

  async history(id: string) {
    await this.requireTicket(id);

    const entries = await this.prisma.auditLog.findMany({
      where: { entity: 'ticket', entityId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorId: entry.actorId,
      diff: entry.diff,
      createdAt: entry.createdAt,
    }));
  }

  private async requireTicket(id: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private async changeAssignee(user: JwtPayload, ticket: Ticket, assigneeId: string | null) {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Only succeeds if the assignee is still what we read a moment ago.
      const result = await tx.ticket.updateMany({
        where: { id: ticket.id, assigneeId: ticket.assigneeId },
        data: { assigneeId },
      });
      if (result.count === 0) throw new ConflictException(CONCURRENT_UPDATE);

      await recordAudit(tx, {
        actorId: user.sub,
        entity: 'ticket',
        entityId: ticket.id,
        action: assigneeId ? 'ticket.assigned' : 'ticket.unassigned',
        diff: { assigneeId: { from: ticket.assigneeId, to: assigneeId } },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    });
    return toTicketResponse(updated);
  }
}