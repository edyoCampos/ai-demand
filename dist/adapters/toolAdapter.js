import { zodToJsonSchema } from '../core/utils/zodToJsonSchema.js';
export class ToolAdapter {
    static async toAnthropic(tool) {
        const schema = zodToJsonSchema(tool.inputSchema);
        return {
            name: tool.name,
            description: await tool.description({}),
            input_schema: schema,
        };
    }
    static async toOpenAI(tool) {
        const schema = zodToJsonSchema(tool.inputSchema);
        return {
            type: 'function',
            function: {
                name: tool.name,
                description: await tool.description({}),
                parameters: schema,
            },
        };
    }
    static async convert(tools, format) {
        return Promise.all(tools.map(tool => format === 'anthropic' ? ToolAdapter.toAnthropic(tool) : ToolAdapter.toOpenAI(tool)));
    }
}
//# sourceMappingURL=toolAdapter.js.map