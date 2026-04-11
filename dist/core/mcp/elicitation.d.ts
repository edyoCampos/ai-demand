import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ElicitResult } from '@modelcontextprotocol/sdk/types.js';
export type ElicitationHook = (serverName: string, message: string, schema?: Record<string, unknown>) => Promise<ElicitResult | undefined>;
/**
 * ElicitationHandler manages requests from MCP servers for additional information.
 * This is crucial for interactive tools (like OAuth or parameter clarification).
 */
export declare class ElicitationHandler {
    private hooks;
    constructor();
    addHook(hook: ElicitationHook): void;
    register(client: Client, serverName: string): void;
}
//# sourceMappingURL=elicitation.d.ts.map