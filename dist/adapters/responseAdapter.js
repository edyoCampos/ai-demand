export class ResponseAdapter {
    static fromAnthropic(event) {
        const e = event;
        if (e.type === 'content_block_delta') {
            const delta = e.delta;
            if (delta.type === 'text_delta') {
                return { type: 'text_delta', content: delta.text };
            }
        }
        if (e.type === 'message_stop') {
            return { type: 'stop', stopReason: 'end_turn' };
        }
        return null;
    }
    static fromOpenAI(event) {
        const e = event;
        const choice = (e.choices || [])[0];
        if (!choice)
            return null;
        const delta = choice.delta;
        if (delta?.content) {
            return { type: 'text_delta', content: delta.content };
        }
        if (choice.finish_reason === 'stop') {
            return { type: 'stop', stopReason: 'end_turn' };
        }
        return null;
    }
}
//# sourceMappingURL=responseAdapter.js.map