import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { TicketStatus, TicketPriority } from '../../generated/prisma/enums.js';

export class FilterTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  category_id?: number;
}