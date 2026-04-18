import { z } from 'zod';
import { PersistenceAdapter } from '../persistence.js';

/**
 * Creates the expand_content tool.
 * Allows the Agent to retrieve the full original content of a 
 * semantic-folded (collapsed) message from the database.
 */
export function createUnfoldTool(persistence: PersistenceAdapter, sessionId: string) {
  return {
    name: 'expand_content',
    description: 'Retrieves the full original content of a message that was previously collapsed (folded) for token efficiency.',
    inputSchema: z.object({
      message_index: z.number().describe('The index of the message in the current history to expand (0-indexed).'),
    }),
    execute: async (input: { message_index: number }) => {
      // 1. Load full messages (Boundary bypassed)
      const loadResult = await persistence.loadMessages(sessionId);
      const history = loadResult.messages;
      const target = history[input.message_index];

      if (!target) {
        throw new Error(`Message at index ${input.message_index} not found.`);
      }

      // 2. Mark as STICKY in memory and subsequently in DB (persistence logic handles differential save)
      target.metadata = { 
        ...target.metadata, 
        sticky: true,
        sticky_turns_left: 3 // Focus area remains active for 3 turns
      };
      
      await persistence.saveMessages(sessionId, history);

      return {
        data: {
          original_content: target.content,
          metadata: target.metadata,
          system_note: "This message has been marked as STICKY and will remain in active context for subsequent turns."
        }
      };
    }
  };
}
