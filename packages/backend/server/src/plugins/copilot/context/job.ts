import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

import {
  AFFiNELogger,
  Config,
  EventBus,
  JobQueue,
  metrics,
  OnEvent,
  OnJob,
} from '../../../base';
import { DocReader } from '../../../core/doc';
import { OpenAIEmbeddingClient } from './embedding';
import { Chunk, Embedding, EmbeddingClient } from './types';

declare global {
  interface Jobs {
    'doc.embedPendingDocs': {
      workspaceId: string;
      docId: string;
    };

    'doc.embedPendingFiles': {
      contextId: string;
      fileId: string;
      chunks: Chunk[];
      total: number;
    };
  }
}

@Injectable()
export class CopilotContextDocJob {
  private readonly client: EmbeddingClient | undefined;

  constructor(
    config: Config,
    private readonly db: PrismaClient,
    private readonly doc: DocReader,
    private readonly event: EventBus,
    private readonly logger: AFFiNELogger,
    private readonly queue: JobQueue
  ) {
    this.logger.setContext(CopilotContextDocJob.name);
    const configure = config.plugins.copilot.openai;
    if (configure) {
      this.client = new OpenAIEmbeddingClient(new OpenAI(configure));
    }
  }

  // public this client to allow overriding in tests
  get embeddingClient() {
    return this.client as EmbeddingClient;
  }

  async addFileEmbeddingQueue(fileChunks: Jobs['doc.embedPendingFiles'][]) {
    for (const { contextId, fileId, chunks, total } of fileChunks) {
      await this.queue.add('doc.embedPendingFiles', {
        contextId,
        fileId,
        chunks,
        total,
      });
    }
  }

  @OnEvent('workspace.doc.embedding')
  async addDocEmbeddingQueue(docs: Events['workspace.doc.embedding']) {
    for (const { workspaceId, docId } of docs) {
      await this.queue.add('doc.embedPendingDocs', { workspaceId, docId });
    }
  }

  private processEmbeddings(
    contextOrWorkspaceId: string,
    fileOrDocId: string,
    embeddings: Embedding[]
  ) {
    const groups = embeddings.map(e => [
      randomUUID(),
      contextOrWorkspaceId,
      fileOrDocId,
      e.index,
      e.content,
      Prisma.raw(`'[${e.embedding.join(',')}]'`),
      new Date(),
    ]);
    return Prisma.join(groups.map(row => Prisma.sql`(${Prisma.join(row)})`));
  }

  @OnJob('doc.embedPendingFiles')
  async embedPendingFiles({
    contextId,
    fileId,
    chunks,
    total,
  }: Jobs['doc.embedPendingFiles']) {
    try {
      const embeddings = await this.embeddingClient.generateEmbeddings(chunks);

      const values = this.processEmbeddings(contextId, fileId, embeddings);
      await this.db.$transaction(async tx => {
        await tx.$executeRaw`
          INSERT INTO "ai_context_embeddings"
          ("id", "context_id", "file_id", "chunk", "content", "embedding", "updated_at") VALUES ${values}
          ON CONFLICT (context_id, file_id, chunk) DO UPDATE SET
          content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = excluded.updated_at;
        `;
        const [{ count }] = await tx.$queryRaw<{ count: number }[]>`
          SELECT count(*) as count FROM "ai_context_embeddings"
          WHERE context_id = ${contextId} AND file_id = ${fileId};
        `;
        if (Number(count) === total) {
          this.event.emit('workspace.file.embedded', { contextId, fileId });
        }
      });
    } catch (e: any) {
      metrics.doc
        .counter('auto_embed_pending_files_error')
        .add(1, { contextId, fileId });
      this.logger.error(
        `Failed to embed pending file: ${contextId}::${fileId}`,
        e
      );
    }
  }

  @OnJob('doc.embedPendingDocs')
  async embedPendingDocs({ workspaceId, docId }: Jobs['doc.embedPendingDocs']) {
    try {
      const content = await this.doc.getDocContent(workspaceId, docId);
      if (content) {
        // no need to check if embeddings is empty, will throw internally
        const embeddings = await this.embeddingClient.getFileEmbeddings(
          new File([content.summary], `${content.title}.md`)
        );

        for (const chunks of embeddings) {
          const values = this.processEmbeddings(workspaceId, docId, chunks);
          await this.db.$executeRaw`
              INSERT INTO "ai_workspace_embeddings"
              ("workspace_id", "doc_id", "chunk", "content", "embedding", "updated_at") VALUES ${values}
              ON CONFLICT (context_id, file_id, chunk) DO UPDATE SET
              embedding = EXCLUDED.embedding, updated_at = excluded.updated_at;
            `;
        }
      }
    } catch (e: any) {
      metrics.doc
        .counter('auto_embed_pending_docs_error')
        .add(1, { workspaceId });
      this.logger.error(
        `Failed to embed pending doc: ${workspaceId}::${docId}`,
        e
      );
    }
  }
}
