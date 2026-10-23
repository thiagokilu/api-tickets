import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CompleteEmployeeDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}
