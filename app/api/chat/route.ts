/**
 * Chat endpoint — crew interaction handler
 *
 * All crew messages arrive here first. The Wellbeing agent classifies the intent
 * (question / request / override) before any further routing occurs (spec §6.3).
 *
 * - Questions: answered directly by Wellbeing agent with sensor snapshot context.
 * - Requests + overrides: dispatched through the full dispatcher pipeline.
 *
 * Streaming is used for all Wellbeing-agent responses so the crew sees fast feedback.
 * The dispatcher pipeline runs asynchronously for request/override types while the
 * Wellbeing agent streams an acknowledgement.
 */

import { mastra } from '@/mastra';
import { secretaryStore } from '@/lib/secretary-store';
import { crewProfilesForAgent } from '@/lib/crew-data';

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, threadId, resourceId, greenhouseState, missionSol } = body as {
    messages: unknown[];
    threadId?: string;
    resourceId?: string;
    greenhouseState?: Record<string, unknown>;
    missionSol?: number;
  };

  const wellbeingAgent = mastra.getAgent('wellbeingAgent');

  // Inject live sensor snapshot + secretary context into the conversation
  const secretaryContext = secretaryStore.getAgentContext(3);
  const crewProfile = secretaryStore.getCrewPreferenceProfile();

  const systemContext = [
    crewProfilesForAgent(),
    greenhouseState
      ? `Current greenhouse sensor readings (live):\n${JSON.stringify(greenhouseState, null, 2)}`
      : null,
    secretaryContext ? `Recent mission decisions:\n${secretaryContext}` : null,
    Object.keys(crewProfile.preferences).length > 0
      ? `Crew food preferences: ${JSON.stringify(crewProfile.preferences)}`
      : null,
    missionSol !== undefined ? `Current mission sol: ${missionSol}` : null,
  ].filter(Boolean).join('\n\n');

  const contextMessage = {
    role: 'system' as const,
    content: systemContext,
  };

  const augmentedMessages = [contextMessage, ...messages];

  // Log the crew message to secretary
  const lastUserMessage = [...messages].reverse().find((m) => (m as Record<string, string>).role === 'user') as Record<string, string> | undefined;
  if (lastUserMessage && missionSol !== undefined) {
    secretaryStore.addCrewRequest(lastUserMessage.content, missionSol);
  }

  // Stream response from Wellbeing agent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await wellbeingAgent.stream(augmentedMessages as any, {
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
