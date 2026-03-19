import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AwsClient } from 'aws4fetch';

const KB_MCP_URL = 'https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp';
const KB_TOOL_NAME = 'kb-start-hack-target___knowledge_base_retrieve';

// ─── Lightweight MCP-over-HTTP client ───────────────────────────────────────────
// Session caching: the AwsClient and MCP initialization are reused across calls.
// This eliminates the 3-step handshake (initialize → notification → tool call)
// on every query, reducing KB lookups from 3 HTTP requests to 1.

let _cachedAwsClient: AwsClient | null = null;
let _sessionInitialized = false;
let _initPromise: Promise<void> | null = null;

function getAwsClient(): AwsClient {
  if (!_cachedAwsClient) {
    _cachedAwsClient = new AwsClient({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken: process.env.AWS_SESSION_TOKEN,
      region: 'us-east-2',
      service: 'bedrock',
    });
  }
  return _cachedAwsClient;
}

function jsonRpc(id: number, method: string, params?: unknown) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
}

/** Parse an MCP Streamable-HTTP response: handles plain JSON and SSE frames. */
async function parseMcpResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream')) {
    // Collect SSE frames and return the first `message` event payload
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]') {
          try { return JSON.parse(data); } catch { /* skip malformed */ }
        }
      }
    }
    throw new Error('No parseable SSE data frame in response');
  }

  return res.json();
}

async function mcpCall(aws: AwsClient, id: number, method: string, params?: unknown) {
  const body = jsonRpc(id, method, params);
  const res = await aws.fetch(KB_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`MCP HTTP ${res.status}: ${text}`);
  }

  return parseMcpResponse(res);
}

/** Ensure the MCP session is initialized (once). Uses a promise lock to prevent races. */
async function ensureSession(): Promise<AwsClient> {
  const aws = getAwsClient();
  if (_sessionInitialized) return aws;

  if (!_initPromise) {
    _initPromise = (async () => {
      // 1. Initialize
      const initResult = await mcpCall(aws, 1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'greenhouse-agent', version: '1.0.0' },
      }) as { result?: unknown; error?: { message: string } };

      if (initResult?.error) {
        throw new Error(`MCP initialize failed: ${initResult.error.message}`);
      }

      // 2. Initialized notification (fire-and-forget)
      await aws.fetch(KB_MCP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      }).catch(() => { /* notification, ignore errors */ });

      _sessionInitialized = true;
    })();
  }

  await _initPromise;
  return aws;
}

/** Query the knowledge base. Reuses cached MCP session — only 1 HTTP request per query. */
async function retrieveFromKnowledgeBase(query: string, maxResults: number): Promise<string> {
  let aws: AwsClient;
  try {
    aws = await ensureSession();
  } catch {
    // Session init failed — reset and retry with fresh session
    _sessionInitialized = false;
    _initPromise = null;
    _cachedAwsClient = null;
    aws = await ensureSession();
  }

  const callResult = await mcpCall(aws, 2, 'tools/call', {
    name: KB_TOOL_NAME,
    arguments: { query, max_results: maxResults },
  }) as { result?: { content?: Array<{ type: string; text?: string }> }; error?: { message: string } };

  if (callResult?.error) {
    // If the session expired, reset and retry once
    if (callResult.error.message?.includes('session') || callResult.error.message?.includes('expired')) {
      _sessionInitialized = false;
      _initPromise = null;
      _cachedAwsClient = null;
      aws = await ensureSession();
      const retry = await mcpCall(aws, 3, 'tools/call', {
        name: KB_TOOL_NAME,
        arguments: { query, max_results: maxResults },
      }) as { result?: { content?: Array<{ type: string; text?: string }> }; error?: { message: string } };
      if (retry?.error) throw new Error(`KB tool call failed: ${retry.error.message}`);
      const retryTexts = (retry?.result?.content ?? []).filter((c) => c.type === 'text' && c.text).map((c) => c.text as string);
      return retryTexts.length > 0 ? retryTexts.join('\n\n---\n\n') : 'No relevant information found in the knowledge base for this query.';
    }
    throw new Error(`KB tool call failed: ${callResult.error.message}`);
  }

  const content = callResult?.result?.content ?? [];
  const texts = content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text as string);

  if (texts.length === 0) {
    return 'No relevant information found in the knowledge base for this query.';
  }

  return texts.join('\n\n---\n\n');
}

// ─── Mastra Tool ─────────────────────────────────────────────────────────────────

export const knowledgeBaseTool = createTool({
  id: 'query-mars-knowledge-base',
  description:
    'Query the Mars crop and greenhouse scientific knowledge base. ' +
    'Use this to look up: plant stress symptoms and treatments, nutritional requirements, ' +
    'Mars environmental constraints, operational scenarios, crop biology, ' +
    'hydroponic best practices, and mission-specific agricultural guidelines. ' +
    'Always consult this before making recommendations on unfamiliar crop conditions.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('Natural language question or topic to search for in the knowledge base'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe('Number of knowledge chunks to retrieve (default 5)'),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const text = await retrieveFromKnowledgeBase(query, maxResults ?? 5);
      return { success: true, content: text };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: String(err),
      };
    }
  },
});
