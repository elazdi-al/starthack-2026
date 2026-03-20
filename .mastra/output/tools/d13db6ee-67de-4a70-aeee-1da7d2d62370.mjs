import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AwsClient } from 'aws4fetch';

const KB_MCP_URL = "https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp";
const KB_TOOL_NAME = "kb-start-hack-target___knowledge_base_retrieve";
let _cachedAwsClient = null;
let _sessionInitialized = false;
let _initPromise = null;
function getAwsClient() {
  if (!_cachedAwsClient) {
    _cachedAwsClient = new AwsClient({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      sessionToken: process.env.AWS_SESSION_TOKEN,
      region: "us-east-2",
      service: "bedrock"
    });
  }
  return _cachedAwsClient;
}
function jsonRpc(id, method, params) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, ...params ? { params } : {} });
}
async function parseMcpResponse(res) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") {
          try {
            return JSON.parse(data);
          } catch {
          }
        }
      }
    }
    throw new Error("No parseable SSE data frame in response");
  }
  return res.json();
}
async function mcpCall(aws, id, method, params) {
  const body = jsonRpc(id, method, params);
  const res = await aws.fetch(KB_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`MCP HTTP ${res.status}: ${text}`);
  }
  return parseMcpResponse(res);
}
async function ensureSession() {
  const aws = getAwsClient();
  if (_sessionInitialized) return aws;
  if (!_initPromise) {
    _initPromise = (async () => {
      const initResult = await mcpCall(aws, 1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "greenhouse-agent", version: "1.0.0" }
      });
      if (initResult?.error) {
        throw new Error(`MCP initialize failed: ${initResult.error.message}`);
      }
      await aws.fetch(KB_MCP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
      }).catch(() => {
      });
      _sessionInitialized = true;
    })();
  }
  await _initPromise;
  return aws;
}
async function retrieveFromKnowledgeBase(query, maxResults) {
  let aws;
  try {
    aws = await ensureSession();
  } catch {
    _sessionInitialized = false;
    _initPromise = null;
    _cachedAwsClient = null;
    aws = await ensureSession();
  }
  const callResult = await mcpCall(aws, 2, "tools/call", {
    name: KB_TOOL_NAME,
    arguments: { query, max_results: maxResults }
  });
  if (callResult?.error) {
    if (callResult.error.message?.includes("session") || callResult.error.message?.includes("expired")) {
      _sessionInitialized = false;
      _initPromise = null;
      _cachedAwsClient = null;
      aws = await ensureSession();
      const retry = await mcpCall(aws, 3, "tools/call", {
        name: KB_TOOL_NAME,
        arguments: { query, max_results: maxResults }
      });
      if (retry?.error) throw new Error(`KB tool call failed: ${retry.error.message}`);
      const retryTexts = (retry?.result?.content ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text);
      return retryTexts.length > 0 ? retryTexts.join("\n\n---\n\n") : "No relevant information found in the knowledge base for this query.";
    }
    throw new Error(`KB tool call failed: ${callResult.error.message}`);
  }
  const content = callResult?.result?.content ?? [];
  const texts = content.filter((c) => c.type === "text" && c.text).map((c) => c.text);
  if (texts.length === 0) {
    return "No relevant information found in the knowledge base for this query.";
  }
  return texts.join("\n\n---\n\n");
}
const knowledgeBaseTool = createTool({
  id: "query-mars-knowledge-base",
  description: "Query the Mars crop and greenhouse scientific knowledge base. Use this to look up: plant stress symptoms and treatments, nutritional requirements, Mars environmental constraints, operational scenarios, crop biology, hydroponic best practices, and mission-specific agricultural guidelines. Always consult this before making recommendations on unfamiliar crop conditions.",
  inputSchema: z.object({
    query: z.string().describe("Natural language question or topic to search for in the knowledge base"),
    maxResults: z.number().int().min(1).max(10).default(5).describe("Number of knowledge chunks to retrieve (default 5)")
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const text = await retrieveFromKnowledgeBase(query, maxResults ?? 5);
      return { success: true, content: text };
    } catch (err) {
      return {
        success: false,
        content: "",
        error: String(err)
      };
    }
  }
});

export { knowledgeBaseTool };
