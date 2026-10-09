import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import { toTicketResponse } from './ticket.mapper.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: JwtPayload, dto: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: { subject: dto.subject, body: dto.body, customerId: user.sub },
    });
    return toTicketResponse(ticket);
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