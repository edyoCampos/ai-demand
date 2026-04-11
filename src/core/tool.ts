import { z } from 'zod';

export interface ToolResult<T = any> {
  data: T;
  isError?: boolean;
}

export interface Tool<T extends z.ZodTypeAny = any> {
  name: string;
  description: string;
  inputSchema: T;
  
  /**
   * Optional JSON Schema override. 
   * If provided, this will be used for AI communication instead of converting inputSchema.
   */
  jsonSchema?: Record<string, unknown>;
  
  execute(args: z.infer<T>): Promise<ToolResult>;
}
