import { Message } from '../types/message.js';
export interface PersistenceAdapter {
    loadMessages(conversationId: string): Promise<Message[]>;
    saveMessages(conversationId: string, messages: Message[]): Promise<void>;
}
export declare class MemoryPersistence implements PersistenceAdapter {
    private store;
    loadMessages(conversationId: string): Promise<Message[]>;
    saveMessages(conversationId: string, messages: Message[]): Promise<void>;
}
//# sourceMappingURL=persistence.d.ts.map