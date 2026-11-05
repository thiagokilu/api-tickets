
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';

@Injectable()
export class RagIngestionService implements OnModuleInit {
  private vectorStore: PGVectorStore;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: 'text-embedding-004',
      apiKey: this.config.getOrThrow('GEMINI_API_KEY'),
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

    await this.vectorStore.addDocuments(chunks);

    return {
      message: 'Documento indexado com sucesso!',
      chunks: chunks.length,
    };
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
