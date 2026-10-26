import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteEmployeeDto {
  @ApiProperty({ example: 'agente@empresa.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
