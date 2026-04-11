import type { Message } from '../core/types/message.js';
export type MessageFormatType = 'anthropic' | 'openai';
export declare class MessageAdapter {
    static convert(messages: Message[], format: MessageFormatType): Record<string, unknown>[];
}
//# sourceMappingURL=messageAdapter.d.ts.map