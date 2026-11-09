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
  HttpCode,
  HttpStatus,
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
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Request() req: RequestWithUser) {
    return {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza o nome do usuário autenticado' })
  updateProfile(
    @Request() req: RequestWithUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.userId, updateProfileDto.username);
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
  @Get('users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista todos os usuários (somente administrador)' })
  listUsers() {
    return this.authService.listUsers();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @Post('updaterole')
  updateRole(@Body() updateRoleDto: UpdateRoleDto) {
    return this.authService.updateRole(updateRoleDto.userId, updateRoleDto.role);
  }
}

