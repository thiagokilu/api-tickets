import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../services/prisma.js';
import { TicketAccessService } from './ticket-access.service.js';
import { TicketFilesService } from './ticket-files.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TicketFilesService', () => {
  let service: TicketFilesService;
  let ticket: {
    id: string;
    assigned_to_id: string | null;
    requester_id: string;
    client_files: string[];
  };
  let send: ReturnType<typeof vi.fn>;

  const prisma = {
    $transaction: vi.fn(),
    tickets: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ticketHistory: {
      create: vi.fn(),
    },
  };

  const config = {
    getOrThrow: vi.fn((key: string) => ({
      S3_ENDPOINT: 'https://storage.example.com/s3',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'tickets',
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: 'secret-key',
    })[key]),
  };

  const makeFile = (overrides: Partial<Express.Multer.File> = {}) => {
    const buffer = Buffer.from('test file content');
    return {
      buffer,
      size: buffer.length,
      mimetype: 'text/plain',
      originalname: 'test.txt',
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as never,
      ...overrides,
    } satisfies Express.Multer.File;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    send = vi.fn().mockResolvedValue({});
    vi.spyOn(S3Client.prototype, 'send').mockImplementation(send);

    ticket = {
      id: 'ticket-1',
      assigned_to_id: 'agent-1',
      requester_id: 'client-1',
      client_files: ['previous-file.pdf'],
    };
    prisma.tickets.findUnique.mockResolvedValue(ticket);
    prisma.tickets.update.mockImplementation(async ({ data }: any) => {
      ticket.client_files.push(data.client_files.push);
      return { ...ticket };
    });
    prisma.ticketHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));

    service = new TicketFilesService(
      prisma as unknown as PrismaService,
      new TicketAccessService(),
      config as unknown as ConfigService,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('stores an allowed file in S3, updates the ticket and records history', async () => {
    const result = await service.uploadFile(ticket.id, makeFile(), 'client-1', Role.CLIENT);
    const command = send.mock.calls[0][0] as PutObjectCommand;

    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'tickets',
      Key: expect.stringMatching(/^tickets\/ticket-1\/.+\.txt$/),
      Body: Buffer.from('test file content'),
      ContentType: 'text/plain',
    });
    expect(result.client_files).toEqual(['previous-file.pdf', result.uploaded_file]);
    expect(result.download_url).toBe(`/tickets/${ticket.id}/files/${result.uploaded_file}`);
    expect(prisma.tickets.update).toHaveBeenCalledWith({
      where: { id: ticket.id },
      data: { client_files: { push: result.uploaded_file } },
    });
    expect(prisma.ticketHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticket_id: ticket.id,
        actor_id: 'client-1',
        field_name: 'client_files',
        old_value: JSON.stringify(['previous-file.pdf']),
        new_value: JSON.stringify(['previous-file.pdf', result.uploaded_file]),
      }),
    });
  });

  it('rejects files larger than 10 MB', async () => {
    await expect(service.uploadFile(ticket.id, makeFile({ size: 10 * 1024 * 1024 + 1 }), 'client-1', Role.CLIENT))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types', async () => {
    await expect(service.uploadFile(ticket.id, makeFile({ mimetype: 'application/octet-stream' }), 'client-1', Role.CLIENT))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects files whose content does not match the declared MIME type', async () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x46, 0x49, 0x46, 0x00]);
    await expect(service.uploadFile(ticket.id, makeFile({ buffer: jpegHeader, mimetype: 'text/plain' }), 'client-1', Role.CLIENT))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects users who cannot access the ticket before writing to S3', async () => {
    await expect(service.uploadFile(ticket.id, makeFile(), 'other-client', Role.CLIENT))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });

  it('removes the stored S3 object if the database transaction fails', async () => {
    prisma.ticketHistory.create.mockRejectedValue(new Error('database failure'));
    await expect(service.uploadFile(ticket.id, makeFile(), 'client-1', Role.CLIENT)).rejects.toThrow('database failure');
    expect(send.mock.calls.map(([command]) => command)).toEqual([
      expect.any(PutObjectCommand),
      expect.any(DeleteObjectCommand),
    ]);
  });

  it('allows authorized users to download a file attached to the ticket', async () => {
    ticket.client_files.push('stored-file.pdf');
    send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) }, ContentType: 'application/pdf' });
    await expect(service.downloadTicketFile(ticket.id, 'stored-file.pdf', 'agent-1', Role.AGENT))
      .resolves.toEqual({ body: Buffer.from([1, 2, 3]), contentType: 'application/pdf' });
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect((send.mock.calls[0][0] as GetObjectCommand).input).toEqual({
      Bucket: 'tickets', Key: 'tickets/ticket-1/stored-file.pdf',
    });
  });

  it('rejects downloads for another user or a filename not attached to the ticket', async () => {
    await expect(service.downloadTicketFile(ticket.id, 'previous-file.pdf', 'other-client', Role.CLIENT))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.downloadTicketFile(ticket.id, 'missing.pdf', 'client-1', Role.CLIENT))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(send).not.toHaveBeenCalled();
  });
});
