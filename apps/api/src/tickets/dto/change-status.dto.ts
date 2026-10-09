import { IsEnum } from 'class-validator';
import { TicketStatus } from '../../generated/prisma/client.js';

export class ChangeStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}