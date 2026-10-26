import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AuthService } from '../src/auth/auth.service.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/services/prisma.js';
import { RedisService } from '../src/services/redis.js';
import { AppModule } from '../src/app.module.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redisService: RedisService;
  let authService: AuthService;
  let adminId: string;
  let adminToken: string;

  const testId = randomUUID();
  const user = {
    username: `client-${testId}`,
    email: `client-${testId}@example.com`,
    password: 'password123',
  };
  const employee = {
    username: `agent-${testId}`,
    email: `agent-${testId}@example.com`,
    password: 'password123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    redisService = app.get(RedisService);
    authService = app.get(AuthService);

    const admin = await prisma.user.create({
      data: {
        username: `admin-${testId}`,
        email: `admin-${testId}@example.com`,
        password_hash: 'e2e-only',
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;
    adminToken = (await authService.createSession(admin)).access_token;
  });

  afterAll(async () => {
    if (adminId) {
      const createdUsers = await prisma.user.findMany({
        where: { email: { in: [user.email, employee.email] } },
        select: { id: true },
      });
      await redisService.client.del(
        `user:${adminId}:token`,
        ...createdUsers.map(({ id }) => `user:${id}:token`),
      );
      await prisma.user.deleteMany({
        where: { id: { in: [adminId, ...createdUsers.map(({ id }) => id)] } },
      });
    }
    await app.close();
  });

  it('/auth/register (POST)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    expect(response.body.access_token).toEqual(expect.any(String));
  });

  it('/auth/login (POST)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(response.body.access_token).toEqual(expect.any(String));
  });

  it('/auth/employee (POST) - requires authentication', () => {
    return request(app.getHttpServer())
      .post('/auth/employee')
      .send({ email: employee.email })
      .expect(401);
  });

  it('invites and completes an employee account', async () => {
    const inviteResponse = await request(app.getHttpServer())
      .post('/auth/employee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: employee.email })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/employee/complete')
      .send({
        token: inviteResponse.body.invite_token,
        username: employee.username,
        password: employee.password,
      })
      .expect(201);

    expect(response.body.access_token).toEqual(expect.any(String));
  });
});
