import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteEmployeeDto {
  @ApiProperty({ example: 'invite-token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'ana.silva' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'SenhaSegura123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}
