import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RagIngestionService } from '../rag-ingestion/rag-ingestion.service.js';
import { RagService } from './rag.service.js';

describe('RagService', () => {
  let service: RagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: RagIngestionService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'NVIDIA_MODEL'
                ? 'z-ai/glm-5.3-flash'
                : key === 'NVIDIA_BASE_URL'
                  ? 'https://integrate.api.nvidia.com/v1'
                  : 'mock-api-key',
          },
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
