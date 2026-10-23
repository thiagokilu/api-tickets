import { IsOptional, IsString } from 'class-validator';

export class AssignTicketDto {
  @IsString()
  @IsOptional()
  assigned_to_id?: string | null;
}
