import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Roles } from './decorators/roles.decorator.js';
import { RolesGuard } from './guards/role-guard.js';
import { Role } from '../generated/prisma/enums.js';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { InviteEmployeeDto } from './dto/invite-employee.dto.js';
import { CompleteEmployeeDto } from './dto/complete-employee.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
  
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  logout(@Request() req: RequestWithUser) {
    return this.authService.logout(req.user.userId);
  }


  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  @Post('renewtoken')
  renewToken(@Request() req: RequestWithUser) {
    return this.authService.renewToken(req.user.userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @Post('employee')
  inviteEmployee(@Body() inviteEmployeeDto: InviteEmployeeDto) {
    return this.authService.inviteEmployee(inviteEmployeeDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('employee/complete')
  completeEmployee(@Body() completeEmployeeDto: CompleteEmployeeDto) {
    return this.authService.completeEmployee(completeEmployeeDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @Post('updaterole')
  updateRole(@Body() updateRoleDto: UpdateRoleDto) {
    return this.authService.updateRole(updateRoleDto.userId, updateRoleDto.role);
  }
}

