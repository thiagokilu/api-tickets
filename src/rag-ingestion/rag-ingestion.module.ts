import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagIngestionService } from './rag-ingestion.service.js';

@Module({
  imports: [ConfigModule],
  providers: [RagIngestionService],
  exports: [RagIngestionService],
})
export class RagIngestionModule {}
