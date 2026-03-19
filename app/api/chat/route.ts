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
    maxSteps: 5,
    memory: {
      thread: threadId ?? 'default-thread',
      resource: resourceId ?? 'default-user',
    },
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' })}\n\n`,
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
