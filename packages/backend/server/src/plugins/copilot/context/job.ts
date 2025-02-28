import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

import {
  AFFiNELogger,
  CallMetric,
  Config,
  JobQueue,
  metrics,
  OnEvent,
  OnJob,
} from '../../../base';
import { DocReader } from '../../../core/doc';
import { OpenAIEmbeddingClient } from './embedding';
import { EmbeddingClient } from './types';

declare global {
  interface Jobs {
    'doc.embedPendingDocs': {
      workspaceId: string;
      docId: string;
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

  @OnEvent('workspace.doc.embedding')
  async addQueue(docs: Events['workspace.doc.embedding']) {
    for (const { workspaceId, docId } of docs) {
      await this.queue.add('doc.embedPendingDocs', { workspaceId, docId });
    }
  }

  @CallMetric('doc', 'embed_pending_docs')
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
          const groups = chunks.map(e => [
            workspaceId,
            docId,
            e.index,
            e.content,
            Prisma.raw(`'[${e.embedding.join(',')}]'`),
            new Date(),
          ]);
          const values = Prisma.join(
            groups.map(row => Prisma.sql`(${Prisma.join(row)})`)
          );
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
