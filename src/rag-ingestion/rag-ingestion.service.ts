
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';
import { createHash } from 'node:crypto';
import { PrismaService } from '../services/prisma.js';

@Injectable()
export class RagIngestionService implements OnModuleInit {
  private vectorStore: PGVectorStore;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const embeddings = new OpenAIEmbeddings({
      model: 'nvidia/nv-embedqa-mistral-7b-v2',
      apiKey: this.config.getOrThrow('NVIDIA_API_KEY'),
      configuration: {
        baseURL: this.config.getOrThrow('NVIDIA_BASE_URL'),
      },
    });

    this.vectorStore = await PGVectorStore.initialize(
      embeddings,
      {
        postgresConnectionOptions: {
          connectionString:
            this.config.getOrThrow('DATABASE_URL'),
        },
        tableName: 'rag_documents',
        columns: {
          idColumnName: 'id',
          vectorColumnName: 'vector',
          contentColumnName: 'content',
          metadataColumnName: 'metadata',
        },
        distanceStrategy: 'cosine',
      },
    );
  }

async indexDocuments() {
  const chunks = await this.loadAndSplit();

  const ids = chunks.map((chunk, index) =>
    createHash('sha256')
      .update(`${chunk.metadata.source}:${index}:${chunk.pageContent}`)
      .digest('hex'),
  );

  await this.vectorStore.addDocuments(chunks, { ids });
  await this.deleteDocumentsBySource('suport.md');

  return {
    message: 'Documento indexado com sucesso!',
    chunks: chunks.length,
  };
}

private async deleteDocumentsBySource(source: string) {
  await this.prisma.$executeRawUnsafe(
    `DELETE FROM rag_documents WHERE metadata->>'source' = $1`,
    source,
  );
}

  async loadAndSplit() {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const content = await readFile(
      join(process.cwd(), 'src/documents/suport.md'),
      'utf-8',
    );

    const chunkSize = 1000;
    const chunkOverlap = 200;
    const chunks: Document[] = [];

    let start = 0;
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      chunks.push(
        new Document({
          pageContent: content.slice(start, end),
          metadata: { source: 'suport.md' },
        }),
      );
      start += chunkSize - chunkOverlap;
    }

    return chunks;
  }

  getVectorStore() {
    return this.vectorStore;
  }
}
