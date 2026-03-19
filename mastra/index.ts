import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { CloudExporter, DefaultExporter, Observability, SensitiveDataFilter } from '@mastra/observability';
import { greenhouseAgent } from './agents/greenhouse-agent';
import { survivalAgent } from './agents/survival-agent';
import { wellbeingAgent } from './agents/wellbeing-agent';
import { arbiterAgent } from './agents/arbiter-agent';
import { greenhouseControlWorkflow } from './workflows/greenhouse-control';
import { dispatcherWorkflow } from './workflows/dispatcher';

export const mastra = new Mastra({
  workflows: { greenhouseControl: greenhouseControlWorkflow, dispatcher: dispatcherWorkflow },
  agents: { greenhouseAgent, survivalAgent, wellbeingAgent, arbiterAgent },
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
        exporters: [
          new DefaultExporter(),
          new CloudExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});
