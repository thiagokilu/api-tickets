import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../services/prisma.js';
import { TicketAccessService } from './ticket-access.service.js';
import { TicketFilesService } from './ticket-files.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TicketFilesService', () => {
  let service: TicketFilesService;
  let testDirectory: string;
  let ticket: {
    id: string;
    assigned_to_id: string | null;
    requester_id: string;
    client_files: string[];
  };

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

  beforeEach(async () => {
    vi.clearAllMocks();
    testDirectory = await mkdtemp(join(tmpdir(), 'ticket-files-'));
    vi.spyOn(process, 'cwd').mockReturnValue(testDirectory);

    ticket = {
      id: 'ticket-1',
      assigned_to_id: 'agent-1',
      requester_id: 'client-1',
      client_files: ['previous-file.pdf'],
    };
    prisma.tickets.findUnique.mockResolvedValue(ticket);
    prisma.tickets.update.mockImplementation(async ({ data }: any) => {
      const newFile = data.client_files.push;
      ticket.client_files.push(newFile);
      return { ...ticket };
    });
    prisma.ticketHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));

    service = new TicketFilesService(
      prisma as unknown as PrismaService,
      new TicketAccessService(),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(testDirectory, { recursive: true, force: true });
  });

  it('stores an allowed file, updates the ticket and records history', async () => {
    const result = await service.uploadFile(
      ticket.id,
      makeFile(),
      'client-1',
      Role.CLIENT,
    );
    const filename = result.uploaded_file;
    const filePath = resolve(testDirectory, 'uploads', filename);

    expect(await readFile(filePath, 'utf8')).toBe('test file content');
    expect(result.client_files).toEqual(['previous-file.pdf', filename]);
    expect(result.download_url).toBe(`/tickets/${ticket.id}/files/${filename}`);
    expect(prisma.tickets.update).toHaveBeenCalledWith({
      where: { id: ticket.id },
      data: { client_files: { push: filename } },
    });
    expect(prisma.ticketHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticket_id: ticket.id,
        actor_id: 'client-1',
        field_name: 'client_files',
        old_value: JSON.stringify(['previous-file.pdf']),
        new_value: JSON.stringify(['previous-file.pdf', filename]),
      }),
    });
  });

  it('rejects files larger than 10 MB', async () => {
    await expect(
      service.uploadFile(
        ticket.id,
        makeFile({ size: 10 * 1024 * 1024 + 1 }),
        'client-1',
        Role.CLIENT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tickets.update).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types', async () => {
    await expect(
      service.uploadFile(
        ticket.id,
        makeFile({ mimetype: 'application/octet-stream' }),
        'client-1',
        Role.CLIENT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tickets.update).not.toHaveBeenCalled();
  });

  it('rejects files whose content does not match the declared MIME type', async () => {
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x46, 0x49, 0x46, 0x00]);
    await expect(
      service.uploadFile(
        ticket.id,
        makeFile({
          buffer: jpegHeader,
          mimetype: 'text/plain',
        }),
        'client-1',
        Role.CLIENT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tickets.update).not.toHaveBeenCalled();
  });

  it('rejects users who cannot access the ticket before writing a file', async () => {
    await expect(
      service.uploadFile(ticket.id, makeFile(), 'other-client', Role.CLIENT),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(readdir(resolve(testDirectory, 'uploads'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('removes the stored file if the database transaction fails', async () => {
    prisma.ticketHistory.create.mockRejectedValue(new Error('database failure'));

    await expect(
      service.uploadFile(ticket.id, makeFile(), 'client-1', Role.CLIENT),
    ).rejects.toThrow('database failure');
    expect(await readdir(resolve(testDirectory, 'uploads'))).toEqual([]);
  });

  it('allows authorized users to download a file attached to the ticket', async () => {
    ticket.client_files.push('stored-file.pdf');

    await expect(
      service.getTicketFile(ticket.id, 'stored-file.pdf', 'agent-1', Role.AGENT),
    ).resolves.toBe('stored-file.pdf');
  });

  it('rejects downloads for another user or a filename not attached to the ticket', async () => {
    await expect(
      service.getTicketFile(ticket.id, 'previous-file.pdf', 'other-client', Role.CLIENT),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getTicketFile(ticket.id, 'missing.pdf', 'client-1', Role.CLIENT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
