import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { InviteEmployeeDto } from './dto/invite-employee.dto.js';
import { CompleteEmployeeDto } from './dto/complete-employee.dto.js';
import { PrismaService } from '../services/prisma.js';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../services/redis.js';
import { Role } from '../generated/prisma/enums.js';

const EMPLOYEE_INVITE_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}
  generateToken(user: { id: string; email: string }): { access_token: string } {
    return {
      access_token: this.jwtService.sign({
        userId: user.id,
        email: user.email,
      }),
    };
  }

  private async ensureUserIsUnique(email: string, username: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      throw new BadRequestException('Username already exists');
    }
  }

  private employeeInviteKey(token: string) {
    return `employee-invite:${token}`;
  }

  private employeeInviteEmailKey(email: string) {
    return `employee-invite-email:${email}`;
  }

  async createSession(user: { id: string; email: string }) {
    const token = this.generateToken(user);
    await this.redisService.client.set(
      `user:${user.id}:token`,
      token.access_token,
      'EX',
      3600,
    );
    return token;
  }

  async register(registerDto: RegisterDto) {
    await this.ensureUserIsUnique(registerDto.email, registerDto.username);

    const pendingInvite = await this.redisService.client.get(
      this.employeeInviteEmailKey(registerDto.email.toLowerCase()),
    );
    if (pendingInvite) {
      throw new BadRequestException(
        'This email has a pending employee invite',
      );
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: registerDto.username,
        email: registerDto.email,
        password_hash: passwordHash,
        role: Role.CLIENT,
        is_active: true, // fazer ativação de conta por email depois
      },
    });

    return this.createSession(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return this.createSession(user);
  }

  async logout(userId: string) {
    // Remove o token do Redis
    await this.redisService.client.del(`user:${userId}:token`);
    return { message: 'Logout successful' };
  }

  async renewToken(userId: string) {
    // Renova o access token (emite um novo token)
    await this.redisService.client.del(`user:${userId}:token`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.createSession(user);
  }

  async inviteEmployee(inviteEmployeeDto: InviteEmployeeDto) {
    const email = inviteEmployeeDto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const previousToken = await this.redisService.client.get(
      this.employeeInviteEmailKey(email),
    );
    if (previousToken) {
      await this.redisService.client.del(
        this.employeeInviteKey(previousToken),
      );
    }

    const token = randomBytes(32).toString('hex');
    await this.redisService.client.set(
      this.employeeInviteKey(token),
      email,
      'EX',
      EMPLOYEE_INVITE_TTL_SECONDS,
    );
    await this.redisService.client.set(
      this.employeeInviteEmailKey(email),
      token,
      'EX',
      EMPLOYEE_INVITE_TTL_SECONDS,
    );

    return { email, invite_token: token };
  }

  async completeEmployee(completeEmployeeDto: CompleteEmployeeDto) {
    const email = await this.redisService.client.get(
      this.employeeInviteKey(completeEmployeeDto.token),
    );

    if (!email) {
      throw new BadRequestException('Invalid or expired invite');
    }

    await this.ensureUserIsUnique(email, completeEmployeeDto.username);

    const passwordHash = await bcrypt.hash(completeEmployeeDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: completeEmployeeDto.username,
        email,
        password_hash: passwordHash,
        role: Role.AGENT,
        is_active: true,
      },
    });

    await this.redisService.client.del(
      this.employeeInviteKey(completeEmployeeDto.token),
    );
    await this.redisService.client.del(this.employeeInviteEmailKey(email));

    return this.createSession(user);
  }

  async updateRole(userId: string, role: Role) {
    await this.redisService.client.del(`user:${userId}:token`);
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }
}
