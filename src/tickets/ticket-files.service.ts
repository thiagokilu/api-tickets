import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../services/prisma.js';
import { Role } from '../generated/prisma/enums.js';
import { TicketAccessService } from './ticket-access.service.js';
import { fileTypeFromBuffer } from 'file-type';


@Injectable()
export class TicketFilesService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketAccess: TicketAccessService,
    config: ConfigService,
  ) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

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
    const key = this.objectKey(ticketId, filename);
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

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
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
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
  }

  async listTicketFiles(ticketId: string, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.ticketAccess.assertCanAccessFiles(ticket, userId, userRole);

    return ticket.client_files;
  }

  async downloadTicketFile(ticketId: string, filename: string, userId: string, userRole: Role) {
    await this.getTicketFile(ticketId, filename, userId, userRole);
    const result = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(ticketId, filename),
    }));
    if (!result.Body) throw new NotFoundException('File not found');
    return {
      body: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType ?? 'application/octet-stream',
    };
  }

  private objectKey(ticketId: string, filename: string) {
    return `tickets/${ticketId}/${filename}`;
  }
}
