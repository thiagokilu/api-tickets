import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import 'dotenv/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Extrai o token do header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    // Verifica se o token existe no Redis e se é o mesmo
    const storedToken = await this.redisService.client.get(`user:${payload.userId}:token`);
    if (!storedToken || storedToken !== token) {
      throw new UnauthorizedException('Token invalid or expired');
    }

    return { userId: payload.userId, email: payload.email };
  }
}
