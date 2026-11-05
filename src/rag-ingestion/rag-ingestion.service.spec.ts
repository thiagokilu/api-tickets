import { Test, TestingModule } from '@nestjs/testing';
import { RagIngestionService } from './rag-ingestion.service.js';

describe('RagIngestionService', () => {
  let service: RagIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RagIngestionService],
    }).compile();

    service = module.get<RagIngestionService>(RagIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
