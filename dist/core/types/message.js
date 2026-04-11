export function createUserMessage(content, uuid) {
    return {
        type: 'user',
        message: { content },
        uuid: uuid || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
    };
}
export function createAssistantMessage(content, uuid) {
    return {
        type: 'assistant',
        message: { content },
        uuid: uuid || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
    };
}
export function createSystemMessage(content, uuid) {
    return {
        type: 'system',
        message: { content },
        uuid: uuid || crypto.randomUUID(),
    };
}
//# sourceMappingURL=message.js.map