import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { MCPConnection, MCPServerConfig } from './types.js';
import { CapabilityRegistry } from '../registry.js';
import { Tool } from '../tool.js';
import { z } from 'zod';
import { ElicitationHandler } from './elicitation.js';
import { Resource, ResourceContent, ResourceProvider } from './resources.js';

export class MCPManager implements ResourceProvider {
  private connections: Map<string, MCPConnection> = new Map();
  public elicitation: ElicitationHandler = new ElicitationHandler();

  constructor(private registry: CapabilityRegistry) {}

  async connect(config: MCPServerConfig): Promise<void> {
    const env: Record<string, string> = {};
    for (const key in process.env) {
      const val = process.env[key];
      if (val !== undefined) env[key] = val;
    }
    if (config.env) {
      Object.assign(env, config.env);
    }

    let transport: Transport;

    if (config.type === 'http' || config.type === 'sse') {
      const url = new URL(config.url!);
      // Use the modern StreamableHTTP whenever possible (Audit V2 - Item 3.2 Resilience)
      transport = new StreamableHTTPClientTransport(url);
    } else {
      transport = new StdioClientTransport({
        command: config.command || 'node',
        args: config.args || [],
        env
      });
    }

    const client = new Client(
      { name: 'demandAI', version: '1.0.0' },
      { 
        capabilities: { 
          sampling: {}, 
          elicitation: {} 
        } 
      }
    );

    await client.connect(transport);
    this.connections.set(config.name, { config, client, transport });

    // Register elicitation handler for this server (Safe-fail)
    try {
      this.elicitation.register(client, config.name);
    } catch (e: any) {
      console.log(`[MCP_WARNING] Elicitation not supported for ${config.name}: ${e.message}`);
    }

    // Load tools from the server
    const result = await client.listTools();
    const tools = result.tools || [];

    for (const tool of tools) {
      const toolWrapper: Tool = {
        name: `mcp_${config.name}_${tool.name}`,
        description: tool.description || '',
        inputSchema: z.any(),
        jsonSchema: tool.inputSchema as Record<string, unknown>,
        execute: async (args: any) => {
          const callWithRetry = async (attempt: number = 0): Promise<any> => {
            try {
              return await client.callTool({
                name: tool.name,
                arguments: args
              });
            } catch (error: any) {
              // Audit V2 - Item 3.2: Reconnection logic for Network drops
              // If it's a transport error AND we haven't exhausted retries
              const isTransportError = error.message.includes('connection') || error.message.includes('transport') || error.message.includes('closed');
              
              if (isTransportError && attempt < 2) {
                console.log(`[MCP_RESILIENCE] Connection drop detected call for ${tool.name}. Re-initializing lifecycle... (Attempt ${attempt + 1})`);
                try {
                  // Full protocol re-init (Lifecycle Handshake)
                  await this.connect(config); 
                } catch (reconnectErr) {
                  // Fail gracefully if server is truly dead
                }
                return await callWithRetry(attempt + 1);
              }
              throw error;
            }
          };

          const callResult = await callWithRetry();
          return { 
            data: callResult.content, 
            isError: !!callResult.isError 
          };
        }
      };
      this.registry.registerTool(toolWrapper);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.transport.close();
    }
    this.connections.clear();
  }

  getConnections() {
    return Array.from(this.connections.values());
  }

  async listResources(): Promise<Resource[]> {
    const allResources: Resource[] = [];
    for (const conn of this.connections.values()) {
      const { resources } = await conn.client.listResources();
      allResources.push(...(resources || []));
    }
    return allResources;
  }

  async readResource(uri: string): Promise<ResourceContent> {
    for (const conn of this.connections.values()) {
      try {
        const { contents } = await conn.client.readResource({ uri });
        const content = contents[0];
        if (content) {
          return {
            uri,
            text: 'text' in content ? content.text : undefined,
            blob: 'blob' in content ? content.blob : undefined
          };
        }
      } catch {
        continue;
      }
    }
    throw new Error(`Resource not found or inaccessible: ${uri}`);
  }
}
