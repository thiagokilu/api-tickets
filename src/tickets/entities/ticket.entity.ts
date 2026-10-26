import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus, Role } from '../../generated/prisma/enums.js';

export class Ticket {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Não consigo acessar minha conta' })
  title: string;

  @ApiProperty({ example: 'Ao tentar entrar, recebo uma mensagem de erro.' })
  description: string;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.OPEN })
  status: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority, nullable: true, example: TicketPriority.MEDIUM })
  priority: TicketPriority | null;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  requester_id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assigned_to_id: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  category_id: number | null;

  @ApiProperty({ type: [String], example: [] })
  client_files: string[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  resolved_at: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closed_at: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-26T12:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-26T12:00:00.000Z' })
  updated_at: Date;

  @ApiPropertyOptional({ nullable: true, type: 'object', properties: {
    id: { type: 'number', example: 1 }, name: { type: 'string', example: 'Acesso' },
    description: { type: 'string', nullable: true, example: 'Problemas de acesso à conta' },
  } })
  category?: { id: number; name: string; description: string | null } | null;

  @ApiProperty({ type: 'object', properties: {
    id: { type: 'string', format: 'uuid' }, username: { type: 'string', example: 'ana.silva' },
    email: { type: 'string', format: 'email', example: 'ana@empresa.com' },
    role: { type: 'string', enum: Object.values(Role), example: Role.CLIENT },
  } })
  requester: { id: string; username: string; email: string; role: Role };

  @ApiPropertyOptional({ nullable: true, type: 'object', properties: {
    id: { type: 'string', format: 'uuid' }, username: { type: 'string', example: 'agente' },
    email: { type: 'string', format: 'email', example: 'agente@empresa.com' },
    role: { type: 'string', enum: Object.values(Role), example: Role.AGENT },
  } })
  assigned_to?: { id: string; username: string; email: string; role: Role } | null;

  @ApiProperty({ type: 'array', items: { type: 'object', properties: {
    id: { type: 'string', format: 'uuid' }, content: { type: 'string' },
    attachments: { type: 'array', items: { type: 'string' } },
    created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
    user: { type: 'object', properties: {
      id: { type: 'string', format: 'uuid' }, username: { type: 'string' },
      email: { type: 'string', format: 'email' }, role: { type: 'string', enum: Object.values(Role) },
    } },
  } } })
  messages: Array<{
    id: string; content: string; attachments: string[]; created_at: Date; updated_at: Date;
    user: { id: string; username: string; email: string; role: Role };
  }>;
}
