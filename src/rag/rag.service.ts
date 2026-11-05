
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { RagIngestionService } from '../rag-ingestion/rag-ingestion.service.js';

@Injectable()
export class RagService {
  private readonly model: ChatOpenAI;

  constructor(
    private readonly ingestion: RagIngestionService,
    private readonly config: ConfigService,
  ) {
    this.model = new ChatOpenAI({
      model: this.config.getOrThrow<string>('NVIDIA_MODEL'),
      apiKey: this.config.getOrThrow<string>('NVIDIA_API_KEY'),
      configuration: {
        baseURL: this.config.getOrThrow<string>('NVIDIA_BASE_URL'),
      },
      timeout: 300_000,
      temperature: 0,
    });
  }

  async ask(question: string) {
    const vectorStore = this.ingestion.getVectorStore();

    // Busca os 4 trechos mais relevantes
    const documents: Document[] = await vectorStore.similaritySearch(
      question,
      4,
    );

    const context = documents
      .map((doc) => doc.pageContent)
      .join('\n\n');

    const response = await this.model.invoke([
      [
        'system',
        `Você é um assistente de suporte.
         Responda utilizando o contexto fornecido.
         Se não houver informação suficiente,
         informe que não encontrou a resposta.

         CONTEXTO:
         ${context}`,
      ],
      ['human', question],
    ]);

    return {
      answer: response.content,
      sources: documents.map((doc) => doc.metadata),
    };
  }
}
