import { mastra } from '@/mastra';

export async function POST(req: Request) {
  const { messages, threadId, resourceId, greenhouseState } = await req.json();

  const agent = mastra.getAgent('greenhouseAgent');

  const contextMessage = greenhouseState
    ? {
        role: 'system' as const,
        content: `Current greenhouse sensor readings (live):\n${JSON.stringify(greenhouseState, null, 2)}`,
      }
    : null;

  const augmentedMessages = contextMessage
    ? [contextMessage, ...messages]
    : messages;

  const result = await agent.stream(augmentedMessages, {
    maxSteps: 10,
    memory: {
      thread: threadId ?? 'default-thread',
      resource: resourceId ?? 'default-user',
    },
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.fullStream) {
          switch (chunk.type) {
            case 'text-delta': {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'text-delta',
                  text: chunk.payload.text,
                })}\n\n`),
              );
              break;
            }
            case 'tool-call': {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                })}\n\n`),
              );
              break;
            }
            case 'tool-result': {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: chunk.payload.result,
                })}\n\n`),
              );
              break;
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: err instanceof Error ? err.message : 'Stream error' })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
