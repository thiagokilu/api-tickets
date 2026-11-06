import { Test, TestingModule } from '@nestjs/testing';
import { RagController } from './rag.controller.js';
import { RagService } from './rag.service.js';
import { RagIngestionService } from '../rag-ingestion/rag-ingestion.service.js';
import { vi } from 'vitest';

describe('RagController', () => {
  let controller: RagController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagController],
      providers: [
        {
          provide: RagService,
          useValue: { ask: vi.fn() },
        },
        {
          provide: RagIngestionService,
          useValue: { indexDocuments: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<RagController>(RagController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
