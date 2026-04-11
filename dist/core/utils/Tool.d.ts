import type { z } from 'zod';
import type { Message } from '../types/message.js';
import type { PermissionResult } from '../types/permissions.js';
export type AnyObject = z.ZodType<{
    [key: string]: unknown;
}>;
export type ToolResult<T> = {
    data: T;
    newMessages?: Record<string, unknown>[];
};
export type Tool<Input extends AnyObject = AnyObject, Output = unknown> = {
    name: string;
    description(input: z.infer<Input>): Promise<string>;
    inputSchema: Input;
    call(args: z.infer<Input>, context: ToolUseContext): Promise<ToolResult<Output>>;
    isReadOnly(input: z.infer<Input>): boolean;
    isConcurrencySafe(input: z.infer<Input>): boolean;
    isEnabled(): boolean;
    checkPermissions(input: z.infer<Input>, context: ToolUseContext): Promise<PermissionResult>;
    toAutoClassifierInput(input: z.infer<Input>): unknown;
    userFacingName(input?: Partial<z.infer<Input>>): string;
    mapToolResultToToolResultBlockParam(content: Output, toolUseID: string): Record<string, unknown>;
    renderToolUseMessage(input: Partial<z.infer<Input>>, options: Record<string, unknown>): unknown;
};
export type Tools = readonly Tool[];
export type ToolUseContext = {
    options: {
        tools: Tools;
        debug: boolean;
        mainLoopModel: string;
        verbose: boolean;
    };
    abortController: AbortController;
    getAppState(): Record<string, unknown>;
    setAppState(f: (prev: Record<string, unknown>) => Record<string, unknown>): void;
    messages: Message[];
};
//# sourceMappingURL=Tool.d.ts.map