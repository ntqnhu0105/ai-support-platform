import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @Req() req: AuthenticatedRequest) {
    return this.tickets.create(req.user, dto);
  }

  @Get()
  list(@Query() query: ListTicketsQueryDto, @Req() req: AuthenticatedRequest) {
    return this.tickets.list(req.user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.tickets.findOne(req.user, id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('AGENT', 'ADMIN')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tickets.changeStatus(req.user, id, dto);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('AGENT', 'ADMIN')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tickets.assign(req.user, id, dto);
  }

  @Post(':id/unassign')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('AGENT', 'ADMIN')
  unassign(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.tickets.unassign(req.user, id);
  }

  @Get(':id/history')
  @UseGuards(RolesGuard)
  @Roles('AGENT', 'ADMIN')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.history(id);
  }
}