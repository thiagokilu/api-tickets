import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: 'O problema ainda acontece após reiniciar o equipamento.' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ type: [String], example: ['https://cdn.example.com/arquivo.png'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
