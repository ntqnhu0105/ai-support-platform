import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import type { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { toTicketResponse, toTicketSummary } from './ticket.mapper.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: JwtPayload, dto: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: { subject: dto.subject, body: dto.body, customerId: user.sub },
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
}