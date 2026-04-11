import { zodToJsonSchema } from './zodToJsonSchema.js';
export async function toolToAPISchema(tool) {
    const schema = zodToJsonSchema(tool.inputSchema);
    return {
        name: tool.name,
        description: await tool.description(undefined),
        input_schema: schema,
    };
}
//# sourceMappingURL=api.js.map