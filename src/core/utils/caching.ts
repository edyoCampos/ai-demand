import { Message } from '../../types/message.js';

/**
 * Ported logic from DemandAI for prompt caching efficiency.
 * Anthropic supports up to 4 breakpoints. We prioritize:
 * 1. System Prompt
 * 2. Recent tool definitions (automatic via API)
 * 3. Last 2 User messages
 */
export function addCacheBreakpoints(messages: Message[]): Message[] {
  if (messages.length === 0) return messages;

  const result = [...messages];
  
  // Rule: Mark the last user message for caching to speed up turn-arounds
  for (let i = result.length - 1; i >= 0; i--) {
     if (result[i].role === 'user') {
       const msg = result[i];
       if (typeof msg.content === 'string') {
         msg.content = [
           { type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } } as any
         ] as any;
       } else if (Array.isArray(msg.content)) {
         const lastItem = msg.content[msg.content.length - 1];
         if (lastItem && typeof lastItem === 'object') {
            (lastItem as any).cache_control = { type: 'ephemeral' };
         }
       }
       break; // Only mark the most recent one to be safe with limits
     }
  }

  return result;
}
