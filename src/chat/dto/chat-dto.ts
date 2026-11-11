import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({
    enum: ['user', 'model'],
    description: 'Autor da mensagem: usuário ou resposta anterior da IA.',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty()
  role: 'user' | 'model';

  @ApiProperty({ example: 'Meu login não funciona.' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({
    type: [ChatMessageDto],
    description: 'Mensagens anteriores em ordem cronológica. Reenvie o histórico a cada chamada para a IA continuar a conversa. A mensagem atual deve ser enviada em `message`, não repetida aqui.',
    example: [
      { role: 'user', text: 'Meu login não funciona.' },
      { role: 'model', text: 'O que acontece quando você tenta entrar?' },
    ],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[] = [];

  @ApiProperty({ example: 'Aparece uma mensagem de senha incorreta.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ticket cujo contexto deve ser considerado na resposta.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}
