import { File } from 'node:buffer';

import { z } from 'zod';

import { CopilotContextFileNotSupported } from '../../../base';
import { parseDoc } from '../../../native';

declare global {
  interface Events {
    'workspace.doc.embedding': Array<{
      workspaceId: string;
      docId: string;
    }>;
  }
}

export enum ContextFileStatus {
  processing = 'processing',
  finished = 'finished',
  failed = 'failed',
}

export const ContextConfigSchema = z.object({
  workspaceId: z.string(),
  files: z
    .object({
      id: z.string(),
      chunkSize: z.number(),
      name: z.string(),
      status: z.enum([
        ContextFileStatus.processing,
        ContextFileStatus.finished,
        ContextFileStatus.failed,
      ]),
      blobId: z.string(),
      createdAt: z.number(),
    })
    .array(),
  docs: z
    .object({
      id: z.string(),
      createdAt: z.number(),
    })
    .array(),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;
export type ContextDoc = z.infer<typeof ContextConfigSchema>['docs'][number];
export type ContextFile = z.infer<typeof ContextConfigSchema>['files'][number];
export type ContextListItem = ContextDoc | ContextFile;
export type ContextList = ContextListItem[];

export type ChunkSimilarity = {
  chunk: number;
  content: string;
  distance: number | null;
};

export type FileChunkSimilarity = ChunkSimilarity & {
  fileId: string;
};

export type DocChunkSimilarity = ChunkSimilarity & {
  docId: string;
};

export type Embedding = {
  /**
   * The index of the embedding in the list of embeddings.
   */
  index: number;
  content: string;
  embedding: Array<number>;
};

export abstract class EmbeddingClient {
  async getFileEmbeddings(
    file: File,
    signal?: AbortSignal
  ): Promise<Embedding[][]> {
    const buffer = Buffer.from(await file.arrayBuffer());
    let doc;
    try {
      doc = await parseDoc(file.name, buffer);
    } catch (e: any) {
      throw new CopilotContextFileNotSupported({
        fileName: file.name,
        message: e?.message || e?.toString?.() || 'format not supported',
      });
    }
    if (doc && !signal?.aborted) {
      if (!doc.chunks.length) {
        throw new CopilotContextFileNotSupported({
          fileName: file.name,
          message: 'no content found',
        });
      }
      const input = doc.chunks
        .toSorted((a, b) => a.index - b.index)
        .map(chunk => chunk.content);
      // chunk input into 2048 every array
      const chunks = [];
      for (let i = 0; i < input.length; i += 2048) {
        chunks.push(input.slice(i, i + 2048));
      }

      const chunkedEmbeddings: Embedding[][] = [];
      for (const chunk of chunks) {
        const retry = 3;

        let embeddings: Embedding[] = [];
        let error = null;
        for (let i = 0; i < retry; i++) {
          try {
            embeddings = await this.getEmbeddings(chunk);
            break;
          } catch (e) {
            error = e;
          }
        }
        if (error) throw error;
        console.log('embedding', input.length, chunk.length);
        if (embeddings.length !== chunk.length) {
          throw new CopilotContextFileNotSupported({
            fileName: file.name,
            message: 'failed to embed file content',
          });
        }
        chunkedEmbeddings.push(embeddings);
      }

      return chunkedEmbeddings;
    }
    throw new CopilotContextFileNotSupported({
      fileName: file.name,
      message: 'failed to parse file',
    });
  }

  abstract getEmbeddings(
    input: string[],
    signal?: AbortSignal
  ): Promise<Embedding[]>;
}
