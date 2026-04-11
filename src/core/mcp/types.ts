import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface MCPServerConfig {
  name: string;
  type: 'stdio' | 'sse' | 'websocket' | 'http';
  command?: string; // Usado se type for 'stdio'
  args?: string[];
  url?: string;     // Usado se type for 'sse', 'websocket' ou 'http'
  env?: Record<string, string>;
}

export interface MCPConnection {
  config: MCPServerConfig;
  client: Client;
  transport: Transport;
}
