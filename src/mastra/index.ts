import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import {
  CloudExporter,
  DefaultExporter,
  Observability,
  SamplingStrategyType,
  SensitiveDataFilter,
} from '@mastra/observability';
import { arbiterAgent } from '../../mastra/agents/arbiter-agent';
import { greenhouseAgent } from '../../mastra/agents/greenhouse-agent';
import { secretaryAgent } from '../../mastra/agents/secretary-agent';
import { survivalAgent } from '../../mastra/agents/survival-agent';
import { wellbeingAgent } from '../../mastra/agents/wellbeing-agent';
import { secretaryVectorStore } from '../../mastra/tools/secretary-vector-tool';
import { dispatcherWorkflow } from '../../mastra/workflows/dispatcher';
import { greenhouseControlWorkflow } from '../../mastra/workflows/greenhouse-control';

export const mastra = new Mastra({
  workflows: { greenhouseControl: greenhouseControlWorkflow, dispatcher: dispatcherWorkflow },
  agents: { greenhouseAgent, survivalAgent, wellbeingAgent, arbiterAgent, secretaryAgent },
  vectors: { secretaryVectorStore },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new DefaultExporter(), new CloudExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
        serializationOptions: {
          maxStringLength: 4096,
          maxDepth: 10,
          maxArrayLength: 100,
          maxObjectKeys: 75,
        },
      },
    },
  }),
});
