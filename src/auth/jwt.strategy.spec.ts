import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import { vi } from 'vitest';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockRedisService = {
    client: {
      get: vi.fn(),
    },
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw error if JWT_SECRET is not set', () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => {
      new JwtStrategy(mockPrismaService as any, mockRedisService as any);
    }).toThrow('JWT_SECRET environment variable is required');

    process.env.JWT_SECRET = originalSecret;
  });

  it('should throw error if JWT_SECRET is too short', () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'short';

    expect(() => {
      new JwtStrategy(mockPrismaService as any, mockRedisService as any);
    }).toThrow('JWT_SECRET must be at least 32 characters long');

    process.env.JWT_SECRET = originalSecret;
  });

  describe('validate', () => {
    it('should validate token if user exists and token matches Redis', async () => {
      const payload = { userId: 1, email: 'test@test.com' };
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
      });
      mockRedisService.client.get.mockResolvedValue('valid-token');

      const result = await strategy.validate(req, payload);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRedisService.client.get).toHaveBeenCalledWith('user:1:token');
      expect(result).toEqual({ userId: 1, email: 'test@test.com' });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = { userId: 999, email: 'nonexistent@test.com' };
      const req = {
        headers: {
          authorization: 'Bearer any-token',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if token not in Redis', async () => {
      const payload = { userId: 1, email: 'test@test.com' };
      const req = {
        headers: {
          authorization: 'Bearer any-token',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
      });
      mockRedisService.client.get.mockResolvedValue(null);

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if token does not match Redis', async () => {
      const payload = { userId: 1, email: 'test@test.com' };
      const req = {
        headers: {
          authorization: 'Bearer old-token',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
      });
      mockRedisService.client.get.mockResolvedValue('new-token');

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
