import { Tool } from './tool.js';

export interface HookResult {
  behavior: 'allow' | 'deny';
  reason?: string;
}

export type BeforeToolCallHook = (tool: Tool, input: Record<string, unknown>) => Promise<HookResult>;

export class HookManager {
  private beforeHooks: BeforeToolCallHook[] = [];

  addBeforeHook(hook: BeforeToolCallHook): void {
    this.beforeHooks.push(hook);
  }

  async executeBeforeHooks(tool: Tool, input: Record<string, unknown>): Promise<HookResult> {
    for (const hook of this.beforeHooks) {
      const result = await hook(tool, input);
      if (result.behavior === 'deny') return result;
    }
    return { behavior: 'allow' };
  }
}
