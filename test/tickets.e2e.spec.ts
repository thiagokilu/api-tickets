import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AuthService } from '../src/auth/auth.service.js';
import { Role } from '../src/generated/prisma/enums.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/services/prisma.js';
import { RedisService } from '../src/services/redis.js';

describe('TicketsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: RedisService;
  let clientId: string;
  let agentId: string;
  let adminId: string;
  let clientToken: string;
  let agentToken: string;
  let adminToken: string;
  let ticketId: string | undefined;

  const testId = randomUUID();
  const emailFor = (role: string) => `${role}-${testId}@example.com`;

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
    redis = app.get(RedisService);
    const auth = app.get(AuthService);

    const client = await prisma.user.create({
      data: {
        username: `client-${testId}`,
        email: emailFor('client'),
        password_hash: 'e2e-only',
        role: Role.CLIENT,
      },
    });
    const agent = await prisma.user.create({
      data: {
        username: `agent-${testId}`,
        email: emailFor('agent'),
        password_hash: 'e2e-only',
        role: Role.AGENT,
      },
    });
    const admin = await prisma.user.create({
      data: {
        username: `admin-${testId}`,
        email: emailFor('admin'),
        password_hash: 'e2e-only',
        role: Role.ADMIN,
      },
    });

    clientId = client.id;
    agentId = agent.id;
    adminId = admin.id;
    [clientToken, agentToken, adminToken] = await Promise.all([
      auth.createSession(client).then(({ access_token }) => access_token),
      auth.createSession(agent).then(({ access_token }) => access_token),
      auth.createSession(admin).then(({ access_token }) => access_token),
    ]);
  });

  afterAll(async () => {
    if (ticketId) {
      await prisma.tickets.deleteMany({ where: { id: ticketId } });
    }
    if (clientId && agentId && adminId) {
      await redis.client.del(
        `user:${clientId}:token`,
        `user:${agentId}:token`,
        `user:${adminId}:token`,
      );
      await prisma.user.deleteMany({
        where: { id: { in: [clientId, agentId, adminId] } },
      });
    }
    await app.close();
  });

  it('requires authentication', () => {
    return request(app.getHttpServer()).get('/tickets').expect(401);
  });

  it('supports the ticket lifecycle and enforces role access', async () => {
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'E2E ticket', description: 'Ticket created by E2E test' })
      .expect(201);

    ticketId = created.body.id;
    expect(ticketId).toEqual(expect.any(String));
    expect(created.body.requester_id).toBe(clientId);
    expect(created.body.status).toBe('OPEN');

    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get('/tickets?page=1&perPage=10')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(listed.body.data.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(true);
    expect(listed.body.meta.currentPage).toBe(1);

    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Updated E2E ticket' })
      .expect(200);
    expect(updated.body.title).toBe('Updated E2E ticket');

    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);

    const createdMessage = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ content: 'E2E message' })
      .expect(201);
    const messageId = createdMessage.body.id;

    const messages = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(messages.body).toHaveLength(1);
    expect(messages.body[0].content).toBe('E2E message');

    await request(app.getHttpServer())
      .patch(`/tickets/messages/${messageId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ content: 'Updated E2E message' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/history`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);

    const adminHistory = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/history`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminHistory.body.some((item: { field_name: string }) => item.field_name === 'ticket_created')).toBe(true);

    await request(app.getHttpServer())
      .delete(`/tickets/messages/${messageId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const assigned = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigned_to_id: agentId })
      .expect(200);
    expect(assigned.body.assigned_to_id).toBe(agentId);

    const agentTicket = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(agentTicket.body.id).toBe(ticketId);

    const agentUpdate = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'IN_PROGRESS', priority: 'HIGH' })
      .expect(200);
    expect(agentUpdate.body.status).toBe('IN_PROGRESS');
    expect(agentUpdate.body.priority).toBe('HIGH');

    await request(app.getHttpServer())
      .delete(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    ticketId = undefined;

    await request(app.getHttpServer())
      .get(`/tickets/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
