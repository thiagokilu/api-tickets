import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagIngestionService } from './rag-ingestion.service.js';
import { PrismaModule } from '../services/prisma.module.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RagIngestionService],
  exports: [RagIngestionService],
})
export class RagIngestionModule {}
