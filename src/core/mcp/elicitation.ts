import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ElicitRequestSchema, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import { logInfo, logError } from '../utils/log.js';

export type ElicitationHook = (serverName: string, message: string, schema?: Record<string, unknown>) => Promise<ElicitResult | undefined>;

/**
 * ElicitationHandler manages requests from MCP servers for additional information.
 * This is crucial for interactive tools (like OAuth or parameter clarification).
 */
export class ElicitationHandler {
  private hooks: ElicitationHook[] = [];

  constructor() {}

  addHook(hook: ElicitationHook): void {
    this.hooks.push(hook);
  }

  register(client: Client, serverName: string): void {
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      logInfo(`MCP Server "${serverName}" requested elicitation: ${request.params.message}`);

      let requestedSchema: Record<string, unknown> | undefined;
      
      // Safety check for the schema depending on the mode
      if ('requestedSchema' in request.params) {
        requestedSchema = request.params.requestedSchema as Record<string, unknown>;
      }

      // Try to resolve via hooks (automation)
      for (const hook of this.hooks) {
        try {
          const result = await hook(serverName, request.params.message, requestedSchema);
          if (result) return result;
        } catch (err) {
          logError(`Elicitation hook error: ${err}`);
        }
      }

      // Default: If no hook handles it, we have to decline (for now) in Headless mode
      return { action: 'decline' };
    });
  }
}
