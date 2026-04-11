import { Tool } from './tool.js';
export interface HookResult {
    behavior: 'allow' | 'deny';
    reason?: string;
}
export type BeforeToolCallHook = (tool: Tool, input: Record<string, unknown>) => Promise<HookResult>;
export declare class HookManager {
    private beforeHooks;
    addBeforeHook(hook: BeforeToolCallHook): void;
    executeBeforeHooks(tool: Tool, input: Record<string, unknown>): Promise<HookResult>;
}
//# sourceMappingURL=hooks.d.ts.map