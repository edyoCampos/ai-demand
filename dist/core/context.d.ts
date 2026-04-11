import { Message } from '../types/message.js';
export interface PruningOptions {
    maxMessages?: number;
    preserveSystemPrompt?: boolean;
}
/**
 * Manages conversation context by pruning or summarizing old messages.
 */
export declare class ContextManager {
    /**
     * Simple pruning: keeps the last N messages.
     * In a future version, this could be upgraded to summarization.
     */
    static prune(messages: Message[], options?: PruningOptions): Message[];
}
//# sourceMappingURL=context.d.ts.map