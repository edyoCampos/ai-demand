import { zodToJsonSchema } from './zodToSchema.js';
import type { Tool } from '../tool.js';

export async function toolToAPISchema(tool: Tool): Promise<Record<string, unknown>> {
  const schema = zodToJsonSchema(tool.inputSchema);
  return {
    name: tool.name,
    description: tool.description,
    input_schema: schema,
  }
}
