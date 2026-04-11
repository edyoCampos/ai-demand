import { Message, ContentBlock } from '../../types/message.js';

export interface FoldingConfig {
  minCharsToFold: number;
  preserveLastN: number;
}

/**
 * ContextFolder - Semantic reduction specialist.
 * Implements Head/Tail truncation for large content blocks.
 */
export class ContextFolder {
  private config: FoldingConfig;

  constructor(config: Partial<FoldingConfig> = {}) {
    this.config = {
      minCharsToFold: config.minCharsToFold || 1500, // Dobra blocos > 1500 chars
      preserveLastN: config.preserveLastN || 5,      // Nunca dobra as últimas 5 mensagens
    };
  }

  /**
   * Processa o histórico e aplica 'folding' em mensagens antigas e pesadas.
   */
  fold(history: Message[]): Message[] {
    // Audit V2 - Item 6.2: Sticky focus area protection
    return history.map((msg, index) => {
      if ((msg.metadata as any)?.sticky) {
        return msg; // Skip folding for focus areas
      }

      // Rule 1: Do not fold the most recent messages (immediate context)
      if (index >= history.length - this.config.preserveLastN) return msg;

      // Rule 2: Fold tool_results or assistant messages exceeding char limits
      if (Array.isArray(msg.content)) {
        const foldedContent = msg.content.map(block => this.foldBlock(block));
        const isFolded = foldedContent.some(b => (b as any).collapsed);
        
        return {
          ...msg,
          content: foldedContent,
          metadata: { 
            ...msg.metadata, 
            folded: isFolded || msg.metadata?.folded 
          }
        };
      }

      return msg;
    });
  }

  private foldBlock(block: ContentBlock): ContentBlock {
    if (block.type === 'tool_result' && !block.collapsed) {
      if (block.content.length > this.config.minCharsToFold) {
        // Lógica de Folding: Resumimos o conteúdo mantendo apenas os primeiros/últimos 200 chars
        const head = block.content.substring(0, 300);
        const tail = block.content.substring(block.content.length - 300);
        const summary = `${head}\n\n[... FOLDED ${block.content.length - 600} CHARACTERS FOR TOKEN EFFICIENCY ...]\n\n${tail}`;
        
        return {
          ...block,
          collapsed: true,
          original_length: block.content.length,
          content: summary
        };
      }
    }
    return block;
  }
}
