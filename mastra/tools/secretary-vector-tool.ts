/**
 * Secretary Vector Tool — semantic search over mission logs
 *
 * Uses a local LibSQL vector store and Amazon Bedrock's Nova Embed v2
 * (best-in-class Bedrock embedding model: 1024 dims, supports retrieval purpose).
 *
 * Architecture:
 * 1. secretaryVectorStore — LibSQLVector pointing at a local SQLite file
 * 2. secretaryEmbeddingModel — amazon.nova-embed-text-v2:0 via @ai-sdk/amazon-bedrock
 * 3. secretaryVectorTool — Mastra createVectorQueryTool wired to both
 * 4. ingestSecretaryReports() — chunking + embedding + upsert pipeline
 */

import { LibSQLVector } from '@mastra/libsql';
import { MDocument } from '@mastra/rag';
import { createVectorQueryTool } from '@mastra/rag';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { embedMany } from 'ai';
import { getAllSecretaryDocuments, getSecretaryDocumentsSince } from '@/lib/secretary-rag';

// ─── Constants ───────────────────────────────────────────────────────────────

const VECTOR_INDEX_NAME = 'secretary_reports';
const EMBEDDING_DIMENSIONS = 1024; // Nova Embed v2 default

// ─── Bedrock embedding model ────────────────────────────────────────────────

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
});

const secretaryEmbeddingModel = bedrock.embedding('amazon.nova-embed-text-v2:0');

// ─── Local vector store (LibSQL) ─────────────────────────────────────────────

export const secretaryVectorStore = new LibSQLVector({
  id: 'secretary-vector-store',
  url: 'file:./secretary-vectors.db',
});

// ─── Ensure index exists ─────────────────────────────────────────────────────

let indexReady = false;

async function ensureIndex(): Promise<void> {
  if (indexReady) return;
  const indexes = await secretaryVectorStore.listIndexes();
  if (!indexes.includes(VECTOR_INDEX_NAME)) {
    await secretaryVectorStore.createIndex({
      indexName: VECTOR_INDEX_NAME,
      dimension: EMBEDDING_DIMENSIONS,
      metric: 'cosine',
    });
  }
  indexReady = true;
}

// ─── Ingestion pipeline ──────────────────────────────────────────────────────

/**
 * Ingest all secretary reports into the vector store.
 * Each report is chunked (recursive, 512 tokens, 50 overlap), embedded
 * with Nova Embed v2, and upserted with rich metadata.
 *
 * @param sinceTimestamp — if provided, only ingest documents newer than this
 * @returns number of chunks upserted
 */
export async function ingestSecretaryReports(sinceTimestamp?: number): Promise<number> {
  await ensureIndex();

  const docs = sinceTimestamp
    ? getSecretaryDocumentsSince(sinceTimestamp)
    : getAllSecretaryDocuments();

  if (docs.length === 0) return 0;

  let totalChunks = 0;

  // Process in batches of 20 documents to avoid overwhelming the embedding API
  const batchSize = 20;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);

    // Chunk each document
    const allChunks: { text: string; metadata: Record<string, unknown> }[] = [];
    for (const doc of batch) {
      const mdoc = MDocument.fromText(doc.text, doc.metadata);
      const chunks = await mdoc.chunk({
        strategy: 'recursive',
        maxSize: 512,
        overlap: 50,
      });
      for (const chunk of chunks) {
        allChunks.push({
          text: chunk.text,
          metadata: {
            ...doc.metadata,
            chunkIndex: allChunks.length,
          },
        });
      }
    }

    if (allChunks.length === 0) continue;

    // Generate embeddings
    const { embeddings } = await embedMany({
      model: secretaryEmbeddingModel,
      values: allChunks.map(c => c.text),
    });

    // Upsert into vector store
    await secretaryVectorStore.upsert({
      indexName: VECTOR_INDEX_NAME,
      vectors: embeddings,
      metadata: allChunks.map(c => ({
        ...c.metadata,
        text: c.text,
      })),
    });

    totalChunks += allChunks.length;
  }

  return totalChunks;
}

// ─── Mastra tool: query mission logs ─────────────────────────────────────────

/**
 * A Mastra tool that lets agents semantically search over all secretary
 * mission logs (decisions, incidents, weekly reports, memory packages,
 * performance digests, crew preference profiles).
 *
 * The agent provides a natural-language query and receives the most
 * relevant chunks with full metadata.
 */
export const secretaryVectorTool = createVectorQueryTool({
  id: 'query-secretary-mission-logs',
  description:
    'Search the secretary\'s mission log archive using semantic similarity. ' +
    'This contains all decision logs, incident reports, weekly crew reports, ' +
    'mission memory packages, performance digests, and crew preference profiles. ' +
    'Use this to recall past decisions, look up how similar situations were handled, ' +
    'find incident resolutions, review crew preferences over time, or retrieve ' +
    'any historical mission data. Provide a natural language query describing ' +
    'what you want to find.',
  vectorStore: secretaryVectorStore,
  indexName: VECTOR_INDEX_NAME,
  model: secretaryEmbeddingModel,
  enableFilter: true,
  includeSources: true,
});
