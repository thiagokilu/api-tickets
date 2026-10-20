import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { vi } from 'vitest';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    renewToken: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should be able to register a user', async () => {
    const registerDto: RegisterDto = {
      username: 'test',
      email: 'test@test.com',
      password: 'test',
    };

    mockAuthService.register.mockResolvedValue({
      access_token: 'mock-token',
    });

    const result = await controller.register(registerDto);

    expect(authService.register).toHaveBeenCalledWith(registerDto);
    expect(result).toEqual({ access_token: 'mock-token' });
  });

  it('should be able to login a user', async () => {
    const loginDto: LoginDto = {
      email: 'test@test.com',
      password: 'test',
    };

    mockAuthService.login.mockResolvedValue({
      access_token: 'mock-token',
    });

    const result = await controller.login(loginDto);

    expect(authService.login).toHaveBeenCalledWith(loginDto);
    expect(result).toEqual({ access_token: 'mock-token' });
  });

  it('should not be able to login with invalid credentials', async () => {
    const loginDto: LoginDto = {
      email: 'test@test.com',
      password: 'wrongpassword',
    };

    mockAuthService.login.mockRejectedValue(
      new Error('Invalid credentials')
    );

    await expect(controller.login(loginDto)).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('should be able to logout', async () => {
    const mockRequest = {
      user: { userId: 1, email: 'test@test.com' },
    };

    mockAuthService.logout.mockResolvedValue({ message: 'Logout successful' });

    const result = await controller.logout(mockRequest as any);

    expect(authService.logout).toHaveBeenCalledWith(1);
    expect(result).toEqual({ message: 'Logout successful' });
  });

  it('should be able to renew token', async () => {
    const mockRequest = {
      user: { userId: 1, email: 'test@test.com' },
    };

    mockAuthService.renewToken.mockResolvedValue({
      access_token: 'new-mock-token',
    });

    const result = await controller.renewToken(mockRequest as any);

    expect(authService.renewToken).toHaveBeenCalledWith(1);
    expect(result).toEqual({ access_token: 'new-mock-token' });
  });
});
