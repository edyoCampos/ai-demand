export class CapabilityRegistry {
    tools = new Map();
    registerTool(tool) {
        this.tools.set(tool.name, tool);
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getAllTools() {
        return Array.from(this.tools.values());
    }
}
//# sourceMappingURL=registry.js.map