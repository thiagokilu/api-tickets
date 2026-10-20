import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { PrismaService } from '../services/prisma.js';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../services/redis.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}
  generateToken(user: { id: number; email: string }): { access_token: string } {
    return {
      access_token: this.jwtService.sign({
        userId: user.id,
        email: user.email,
      }),
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: registerDto.email,
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: registerDto.username,
        email: registerDto.email,
        password_hash: passwordHash,
        is_active: true, // fazer ativação de conta por email depois
      },
    });

    const token = this.generateToken(user);
    // Salva token no Redis com TTL de 1h (3600 segundos)
    await this.redisService.client.set(
      `user:${user.id}:token`,
      token.access_token,
      'EX',
      3600,
    );
    return token;
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

    const token = this.generateToken(user);
    // Salva token no Redis com TTL de 1h (3600 segundos)
    await this.redisService.client.set(
      `user:${user.id}:token`,
      token.access_token,
      'EX',
      3600,
    );
    return token;
  }

  async logout(userId: number) {
    // Remove o token do Redis
    await this.redisService.client.del(`user:${userId}:token`);
    return { message: 'Logout successful' };
  }

  async renewToken(userId: number) {
    // Renova o access token (emite um novo token)
    await this.redisService.client.del(`user:${userId}:token`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.generateToken(user);
    // Salva token no Redis com TTL de 1h (3600 segundos)
    await this.redisService.client.set(
      `user:${user.id}:token`,
      token.access_token,
      'EX',
      3600,
    );
    return token;
  }
}
