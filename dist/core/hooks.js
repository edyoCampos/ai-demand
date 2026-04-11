export class HookManager {
    beforeHooks = [];
    addBeforeHook(hook) {
        this.beforeHooks.push(hook);
    }
    async executeBeforeHooks(tool, input) {
        for (const hook of this.beforeHooks) {
            const result = await hook(tool, input);
            if (result.behavior === 'deny')
                return result;
        }
        return { behavior: 'allow' };
    }
}
//# sourceMappingURL=hooks.js.map