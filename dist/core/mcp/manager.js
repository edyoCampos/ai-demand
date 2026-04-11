import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import { ElicitationHandler } from './elicitation.js';
export class MCPManager {
    registry;
    connections = new Map();
    elicitation = new ElicitationHandler();
    constructor(registry) {
        this.registry = registry;
    }
    async connect(config) {
        const env = {};
        for (const key in process.env) {
            const val = process.env[key];
            if (val !== undefined)
                env[key] = val;
        }
        if (config.env) {
            Object.assign(env, config.env);
        }
        let transport;
        if (config.type === 'sse' && config.url) {
            transport = new SSEClientTransport(new URL(config.url));
        }
        else {
            transport = new StdioClientTransport({
                command: config.command || 'node',
                args: config.args || [],
                env
            });
        }
        const client = new Client({ name: 'demandAI', version: '1.0.0' }, { capabilities: {} });
        await client.connect(transport);
        this.connections.set(config.name, { config, client, transport });
        // Register elicitation handler for this server
        this.elicitation.register(client, config.name);
        // Load tools from the server
        const result = await client.listTools();
        const tools = result.tools || [];
        for (const tool of tools) {
            const toolWrapper = {
                name: `mcp_${config.name}_${tool.name}`,
                description: tool.description || '',
                inputSchema: z.any(),
                jsonSchema: tool.inputSchema,
                execute: async (args) => {
                    const callResult = await client.callTool({
                        name: tool.name,
                        arguments: args
                    });
                    return {
                        data: callResult.content,
                        isError: !!callResult.isError
                    };
                }
            };
            this.registry.registerTool(toolWrapper);
        }
    }
    async disconnectAll() {
        for (const conn of this.connections.values()) {
            await conn.transport.close();
        }
        this.connections.clear();
    }
    getConnections() {
        return Array.from(this.connections.values());
    }
    async listResources() {
        const allResources = [];
        for (const conn of this.connections.values()) {
            const { resources } = await conn.client.listResources();
            allResources.push(...(resources || []));
        }
        return allResources;
    }
    async readResource(uri) {
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
            }
            catch {
                continue;
            }
        }
        throw new Error(`Resource not found or inaccessible: ${uri}`);
    }
}
//# sourceMappingURL=manager.js.map