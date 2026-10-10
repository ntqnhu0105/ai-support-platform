import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('tickets/:ticketId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.create(req.user, ticketId, dto);
  }

  @Get()
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string, @Req() req: AuthenticatedRequest) {
    return this.comments.list(req.user, ticketId);
  }
}