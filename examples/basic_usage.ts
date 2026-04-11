import 'dotenv/config';
import { z } from 'zod';
import { 
  DemandAI, 
  CapabilityRegistry, 
  ProviderManager, 
  PostgresPersistence,
  Tool 
} from '../src/index.js';

/**
 * 1. Define Capability Tool
 */
const CalculatorSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number(),
});

const calculatorTool: Tool<typeof CalculatorSchema> = {
  name: 'calculator',
  description: 'Performs basic mathematical operations',
  inputSchema: CalculatorSchema,
  async execute(args) {
    const result = 
      args.operation === 'add' ? args.a + args.b :
      args.operation === 'subtract' ? args.a - args.b :
      args.operation === 'multiply' ? args.a * args.b :
      args.a / args.b;
    return { data: { result } };
  }
};

/**
 * 2. Setup DemandAI Kernel
 */
async function main() {
  console.log('Initializing DemandAI Kernel...');

  // Initialize Persistence Layer (PostgreSQL)
  // Ensure DATABASE_URL is set in your environment
  const persistence = new PostgresPersistence({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/demandai'
  });
  await persistence.init();

  const registry = new CapabilityRegistry();
  registry.registerTool(calculatorTool);

  const ai = new DemandAI({
    provider: ProviderManager.fromEnv(),
    persistence,
    registry,
    maxTurns: 10
  });

  const conversationId = 'session-001';
  const userPrompt = 'Calculate 1532 + 2741, then multiply the result by 42.';

  console.log(`\nInput: ${userPrompt}\n`);
  process.stdout.write('DemandAI: ');

  try {
    for await (const event of ai.ask(conversationId, userPrompt)) {
      switch (event.type) {
        case 'text_delta':
          process.stdout.write(event.text);
          break;
        case 'tool_call':
          console.log(`\n[Action] Invoking ${event.name} with arguments: ${JSON.stringify(event.input)}`);
          break;
        case 'tool_result':
          console.log(`[Outcome] Result received: ${JSON.stringify(event.result)}`);
          break;
        case 'usage':
          console.log(`\n\nExecution Metrics: ${event.usage.total_tokens} total tokens consumed.`);
          break;
        case 'stop':
          console.log(`Execution terminated. Reason: ${event.reason}`);
          break;
        case 'error':
          console.error(`\nSystem Error: ${event.error}`);
          break;
      }
    }
  } catch (err) {
    console.error('Fatal initialization error:', err);
  } finally {
    // Graceful shutdown
    await persistence.close();
  }
}

main().catch(console.error);
