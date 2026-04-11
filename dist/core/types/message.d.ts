import type { UUID } from './ids.js';
export type UserMessage = {
    type: 'user';
    message: {
        content: string;
    };
    uuid: UUID;
    timestamp: string;
};
export type AssistantMessage = {
    type: 'assistant';
    message: {
        content: string;
        model?: string;
    };
    uuid: UUID;
    timestamp: string;
};
export type SystemMessage = {
    type: 'system';
    message: {
        content: string;
    };
    uuid: UUID;
};
export type AttachmentMessage = {
    type: 'attachment';
    attachment: Record<string, unknown>;
    uuid: UUID;
    timestamp: string;
};
export type Message = UserMessage | AssistantMessage | SystemMessage | AttachmentMessage;
export type StreamEvent = {
    type: 'text_delta';
    content: string;
} | {
    type: 'stop';
    stopReason: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: unknown;
};
export declare function createUserMessage(content: string, uuid?: UUID): UserMessage;
export declare function createAssistantMessage(content: string, uuid?: UUID): AssistantMessage;
export declare function createSystemMessage(content: string, uuid?: UUID): SystemMessage;
//# sourceMappingURL=message.d.ts.map