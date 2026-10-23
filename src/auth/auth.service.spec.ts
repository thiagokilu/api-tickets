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
import { Role } from '../generated/prisma/enums.js';

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
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(undefined),
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@test.com',
        username: 'testuser',
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.hash as any).mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.CLIENT }),
        }),
      );
      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'user:550e8400-e29b-41d4-a716-446655440000:token',
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
        id: '550e8400-e29b-41d4-a716-446655440000',
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
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@test.com',
        password_hash: '$2b$10$hashedpassword',
        is_active: true,
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'user:550e8400-e29b-41d4-a716-446655440000:token',
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
        id: '550e8400-e29b-41d4-a716-446655440000',
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
      const user = { id: '550e8400-e29b-41d4-a716-446655440000', email: 'test@test.com' };
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
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const result = await service.logout(userId);

      expect(mockRedisService.client.del).toHaveBeenCalledWith('user:550e8400-e29b-41d4-a716-446655440000:token');
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('renewToken', () => {
    it('should generate a new token and replace the old one', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@test.com',
        username: 'testuser',
      });
      mockJwtService.sign.mockReturnValue('new-mock-jwt-token');

      const result = await service.renewToken(userId);

      expect(mockRedisService.client.del).toHaveBeenCalledWith('user:550e8400-e29b-41d4-a716-446655440000:token');
      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'user:550e8400-e29b-41d4-a716-446655440000:token',
        'new-mock-jwt-token',
        'EX',
        3600,
      );
      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('new-mock-jwt-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.renewToken(userId)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('inviteEmployee', () => {
    it('should store an invite token in Redis', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.inviteEmployee({
        email: 'agent@test.com',
      });

      expect(result.email).toBe('agent@test.com');
      expect(result.invite_token).toEqual(expect.any(String));
      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        `employee-invite:${result.invite_token}`,
        'agent@test.com',
        'EX',
        7 * 24 * 3600,
      );
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'agent@test.com',
      });

      await expect(
        service.inviteEmployee({ email: 'agent@test.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeEmployee', () => {
    it('should create an AGENT and return a token', async () => {
      mockRedisService.client.get.mockResolvedValue('agent@test.com');
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'agent@test.com',
        username: 'agent',
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.hash as any).mockResolvedValue('hashed-password');

      const result = await service.completeEmployee({
        token: 'invite-token',
        username: 'agent',
        password: 'password123',
      });

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.AGENT,
            email: 'agent@test.com',
          }),
        }),
      );
      expect(result.access_token).toBe('mock-jwt-token');
    });

    it('should throw BadRequestException if invite is invalid', async () => {
      mockRedisService.client.get.mockResolvedValue(null);

      await expect(
        service.completeEmployee({
          token: 'expired-token',
          username: 'agent',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRole', () => {
    it('should update role without returning password_hash', async () => {
      const updatedUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'testuser',
        email: 'test@test.com',
        role: Role.AGENT,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateRole(
        '550e8400-e29b-41d4-a716-446655440000',
        Role.AGENT,
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        data: { role: Role.AGENT },
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
      expect(result).toEqual(updatedUser);
      expect(result).not.toHaveProperty('password_hash');
    });
  });
});
