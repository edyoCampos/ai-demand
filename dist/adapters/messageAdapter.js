export class MessageAdapter {
    static convert(messages, format) {
        return messages
            .map(msg => msg.type === 'user'
            ? { role: 'user', content: msg.message.content }
            : msg.type === 'assistant'
                ? { role: 'assistant', content: msg.message.content }
                : null)
            .filter((msg) => msg !== null);
    }
}
//# sourceMappingURL=messageAdapter.js.map