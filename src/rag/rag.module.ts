import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagController } from './rag.controller.js';
import { RagService } from './rag.service.js';
import { RagIngestionModule } from '../rag-ingestion/rag-ingestion.module.js';
import { RolesGuard } from '../auth/guards/role-guard.js';

@Module({
  imports: [ConfigModule, RagIngestionModule],
  controllers: [RagController],
  providers: [RagService, RolesGuard],
  exports: [RagService],
})
export class RagModule {}