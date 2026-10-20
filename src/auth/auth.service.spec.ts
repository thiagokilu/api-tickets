import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { vi } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockJwtService = {
    sign: vi.fn(),
  };

  const mockRedisService = {
    client: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue('mock-token'),
      del: vi.fn().mockResolvedValue(undefined),
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
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

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return token', async () => {
      const registerDto: RegisterDto = {
        username: 'testuser',
        email: 'test@test.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        username: 'testuser',
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.hash as any).mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'user:1:token',
        'mock-jwt-token',
        'EX',
        3600,
      );
      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
    });

    it('should throw BadRequestException if user already exists', async () => {
      const registerDto: RegisterDto = {
        username: 'testuser',
        email: 'existing@test.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'existing@test.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('login', () => {
    it('should login with valid credentials and return token', async () => {
      const loginDto: LoginDto = {
        email: 'test@test.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password_hash: '$2b$10$hashedpassword',
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'user:1:token',
        'mock-jwt-token',
        'EX',
        3600,
      );
      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@test.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const loginDto: LoginDto = {
        email: 'test@test.com',
        password: 'wrongpassword',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password_hash: '$2b$10$hashedpassword',
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token', async () => {
      const user = { id: 1, email: 'test@test.com' };
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.generateToken(user);

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: user.id,
        email: user.email,
      });
    });
  });

  describe('logout', () => {
    it('should delete token from Redis', async () => {
      const userId = 1;

      const result = await service.logout(userId);

      expect(mockRedisService.client.del).toHaveBeenCalledWith('user:1:token');
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('renewToken', () => {
    it('should generate a new token and replace the old one', async () => {
      const userId = 1;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        username: 'testuser',
      });
      mockJwtService.sign.mockReturnValue('new-mock-jwt-token');

      const result = await service.renewToken(userId);

      expect(mockRedisService.client.del).toHaveBeenCalledWith('user:1:token');
      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'user:1:token',
        'new-mock-jwt-token',
        'EX',
        3600,
      );
      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('new-mock-jwt-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const userId = 999;

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.renewToken(userId)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
