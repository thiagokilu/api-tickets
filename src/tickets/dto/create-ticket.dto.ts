import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ example: 'Não consigo acessar minha conta' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'Ao tentar entrar, recebo uma mensagem de erro.' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category_id?: number;
}
