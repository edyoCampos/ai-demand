import { Tool } from './tool.js';
export declare class CapabilityRegistry {
    private tools;
    registerTool(tool: Tool): void;
    getTool(name: string): Tool | undefined;
    getAllTools(): Tool[];
}
//# sourceMappingURL=registry.d.ts.map