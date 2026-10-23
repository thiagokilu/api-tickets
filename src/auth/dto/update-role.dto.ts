import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { Role } from '../../generated/prisma/enums.js';

export class UpdateRoleDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(Role)
  role: Role;
}
