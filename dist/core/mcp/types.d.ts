import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export interface MCPServerConfig {
    name: string;
    type: 'stdio' | 'sse' | 'websocket';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
}
export interface MCPConnection {
    config: MCPServerConfig;
    client: Client;
    transport: Transport;
}
//# sourceMappingURL=types.d.ts.map