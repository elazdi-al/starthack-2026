/**
 * MCP Streamable HTTP endpoint.
 *
 * Exposes the Mars greenhouse simulation state as MCP tools that any
 * MCP-compatible client (Claude Desktop, Cursor, etc.) can connect to.
 *
 * Uses stateless mode — each HTTP request is a self-contained JSON-RPC
 * exchange. No session tracking is needed since the tools only read from
 * the in-memory snapshot cache.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";

async function handleMcpRequest(req: Request): Promise<Response> {
  const server = createMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}

export async function GET(req: Request) {
  return handleMcpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
