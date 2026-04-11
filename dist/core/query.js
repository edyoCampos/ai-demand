export async function* query(params) {
    const deps = params.deps || {
        callModel: async function* () { },
        uuid: () => crypto.randomUUID(),
    };
    const messages = [...params.messages];
    let continueLoop = true;
    while (continueLoop) {
        for await (const event of deps.callModel({
            messages,
            systemPrompt: params.systemPrompt,
            tools: params.tools,
        })) {
            yield event;
            if (event.type === 'stop' && event.stopReason === 'end_turn') {
                continueLoop = false;
                break;
            }
        }
        if (!continueLoop)
            break;
    }
}
//# sourceMappingURL=query.js.map