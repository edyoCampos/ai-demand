import { Message } from '../../types/message.js';
/**
 * Ported logic from openclaude for prompt caching efficiency.
 * Anthropic supports up to 4 breakpoints. We prioritize:
 * 1. System Prompt
 * 2. Recent tool definitions (automatic via API)
 * 3. Last 2 User messages
 */
export declare function addCacheBreakpoints(messages: Message[]): Message[];
//# sourceMappingURL=caching.d.ts.map