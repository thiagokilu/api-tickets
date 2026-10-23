import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto.js';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
