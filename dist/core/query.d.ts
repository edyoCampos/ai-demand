import type { Message, StreamEvent } from './types/message.js';
import type { Tool, ToolUseContext } from './utils/Tool.js';
export type QueryParams = {
    messages: Message[];
    systemPrompt: string[];
    tools: Tool[];
    userContext: Record<string, string>;
    systemContext: Record<string, string>;
    canUseTool: (tool: Tool, context: ToolUseContext) => Promise<boolean>;
    toolUseContext: ToolUseContext;
    deps?: QueryDeps;
};
export type QueryDeps = {
    callModel: (params: any) => AsyncGenerator<StreamEvent>;
    uuid: () => string;
};
export declare function query(params: QueryParams): AsyncGenerator<StreamEvent>;
//# sourceMappingURL=query.d.ts.map