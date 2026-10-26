import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto.js';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @ApiPropertyOptional({ enum: TicketPriority, example: TicketPriority.HIGH })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketStatus, example: TicketStatus.IN_PROGRESS })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
