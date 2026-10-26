import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsOptional()
  assigned_to_id?: string | null;
}
