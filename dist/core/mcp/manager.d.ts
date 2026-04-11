import { MCPConnection, MCPServerConfig } from './types.js';
import { CapabilityRegistry } from '../registry.js';
import { ElicitationHandler } from './elicitation.js';
import { Resource, ResourceContent, ResourceProvider } from './resources.js';
export declare class MCPManager implements ResourceProvider {
    private registry;
    private connections;
    elicitation: ElicitationHandler;
    constructor(registry: CapabilityRegistry);
    connect(config: MCPServerConfig): Promise<void>;
    disconnectAll(): Promise<void>;
    getConnections(): MCPConnection[];
    listResources(): Promise<Resource[]>;
    readResource(uri: string): Promise<ResourceContent>;
}
//# sourceMappingURL=manager.d.ts.map