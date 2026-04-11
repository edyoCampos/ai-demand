import 'dotenv/config';
import { z } from 'zod';
import { DemandAI, CapabilityRegistry, ProviderFactory } from './index.js';
// 1. Define a tool
const CalculatorSchema = z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
});
const calculatorTool = {
    name: 'calculator',
    description: 'Performs basic math operations',
    inputSchema: CalculatorSchema,
    async execute(args) {
        const result = args.operation === 'add' ? args.a + args.b :
            args.operation === 'subtract' ? args.a - args.b :
                args.operation === 'multiply' ? args.a * args.b :
                    args.a / args.b;
        return { data: { result } };
    }
};
// 2. Setup DemandAI
async function main() {
    console.log('🧪 Testing demandAI Kernel...');
    const registry = new CapabilityRegistry();
    registry.registerTool(calculatorTool);
    const ai = new DemandAI({
        provider: ProviderFactory.fromEnv(),
        registry,
        maxTurns: 5 // Rigorous limit for testing
    });
    const conversationId = 'test-session-001';
    const userPrompt = 'Quanto é 1532 + 2741? E o resultado vezes 42?';
    console.log(`\nUser: ${userPrompt}\n`);
    process.stdout.write('demandAI: ');
    for await (const event of ai.ask(conversationId, userPrompt)) {
        if (event.type === 'text_delta') {
            process.stdout.write(event.text);
        }
        else if (event.type === 'tool_call') {
            console.log(`\n[Decision] Running ${event.name} with ${JSON.stringify(event.input)}`);
        }
        else if (event.type === 'tool_result') {
            console.log(`[Result] ${JSON.stringify(event.result)}`);
        }
        else if (event.type === 'usage') {
            console.log(`\n\n📊 Usage: ${event.usage.total_tokens} tokens total.`);
        }
        else if (event.type === 'stop') {
            console.log(`✅ Done (Reason: ${event.reason})`);
        }
        else if (event.type === 'error') {
            console.error(`\n❌ Error: ${event.error}`);
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=main.js.map