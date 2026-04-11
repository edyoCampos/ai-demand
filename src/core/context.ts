import { Message } from '../types/message.js';

export interface PruningOptions {
  maxMessages?: number;
  preserveSystemPrompt?: boolean;
}

/**
 * Manages conversation context by pruning or summarizing old messages.
 */
export class ContextManager {
  /**
   * Simple pruning: keeps the last N messages.
   * In a future version, this could be upgraded to summarization.
   */
  static prune(messages: Message[], options: PruningOptions = {}): Message[] {
    const limit = options.maxMessages || 20;
    
    if (messages.length <= limit) return messages;

    const systemMessages = options.preserveSystemPrompt 
      ? messages.filter(m => m.role === 'system')
      : [];
    
    const otherMessages = messages.filter(m => m.role !== 'system');
    const recentMessages = otherMessages.slice(-limit);

    // Ensure we keep the context coherent by starting with the system prompt if preserved
    return [...systemMessages, ...recentMessages];
  }
}
