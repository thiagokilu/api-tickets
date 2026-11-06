import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../services/prisma.js';
import { RagIngestionService } from './rag-ingestion.service.js';
import { vi } from 'vitest';

describe('RagIngestionService', () => {
  let service: RagIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagIngestionService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: vi.fn() },
        },
        {
          provide: PrismaService,
          useValue: { $executeRawUnsafe: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<RagIngestionService>(RagIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
