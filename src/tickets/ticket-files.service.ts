import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../services/prisma.js';
import { Role } from '../generated/prisma/enums.js';
import { TicketAccessService } from './ticket-access.service.js';
import { fileTypeFromBuffer } from 'file-type';


@Injectable()
export class TicketFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  private async validateFileContent(buffer: Buffer, declaredMimetype: string): Promise<boolean> {
    const detectedType = await fileTypeFromBuffer(buffer);
    
    if (!detectedType) {
      return declaredMimetype === 'text/plain';
    }

    const mimeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };

    const expectedExtension = mimeMap[declaredMimetype];
    if (!expectedExtension) {
      return false;
    }

    return detectedType.ext === expectedExtension;
  }

  async uploadFile(ticketId: string, file: Express.Multer.File, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    this.ticketAccess.assertCanAccessFiles(ticket, userId, userRole);

    const allowedTypes: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'text/plain': '.txt',
    };
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the maximum limit of 10MB');
    }
    const extension = allowedTypes[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Unsupported file type');
    }

    if (!(await this.validateFileContent(file.buffer, file.mimetype))) {
      throw new BadRequestException('File content does not match the declared type');
    }

    const filename = `${randomUUID()}${extension}`;
    const uploadDirectory = resolve(process.cwd(), 'uploads');
    const filePath = resolve(uploadDirectory, filename);
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedTicket = await tx.tickets.update({
          where: { id: ticketId },
          data: { client_files: { push: filename } },
        });
        const newFiles = updatedTicket.client_files;
        const oldFiles = newFiles.filter((storedFile) => storedFile !== filename);

        await tx.ticketHistory.create({
          data: {
            ticket_id: ticketId,
            actor_id: userId,
            field_name: 'client_files',
            old_value: JSON.stringify(oldFiles),
            new_value: JSON.stringify(newFiles),
          },
        });

        return {
          ...updatedTicket,
          uploaded_file: filename,
          download_url: `/tickets/${ticketId}/files/${filename}`,
        };
      });
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async getTicketFile(
    ticketId: string,
    filename: string,
    userId: string,
    userRole: Role,
  ) {
    const ticket = await this.prisma.tickets.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.ticketAccess.assertCanAccessFiles(ticket, userId, userRole);
    if (filename.includes('/') || filename.includes('\\') || !ticket.client_files.includes(filename)) {
      throw new NotFoundException('File not found');
    }
    return filename;
  }}
