import { Message, Usage } from '../types/message.js';
import { TokenBudgetManager } from './utils/tokenBudget.js';
import { ContextFolder } from './utils/folding.js';

/**
 * ContextEngine - Semantic Orchestrator.
 * Orchestrates TokenBudgetManager and ContextFolder to maintain 
 * optimal context window utilization.
 */
export class ContextEngine {
  private budget: TokenBudgetManager;
  private folder: ContextFolder;

  constructor(maxTokens?: number) {
    this.budget = new TokenBudgetManager({ maxPromptTokens: maxTokens });
    this.folder = new ContextFolder();
  }

  /**
   * Prepara o histórico para o Provedor.
   * Aplica folding se o orçamento estiver apertado.
   */
  prepare(history: Message[], lastUsage?: Usage): Message[] {
    if (lastUsage) {
      this.budget.updateUsage(lastUsage);
    }

    if (this.budget.shouldCompact()) {
      return this.folder.fold(history);
    }

    // Mesmo que não precise compactar por budget total, podemos aplicar folding 
    // seletivo em mensagens individuais gigantescas    // Perform semantic reduction (Folding)
    // Perform semantic reduction (Folding)
    const collapsedMessages = this.folder.fold(history);
    
    // Tag the summary/boundary message for persistence optimization
    // Locate the latest folded message in the array
    let lastFoldedIndex = -1;
    for (let i = collapsedMessages.length - 1; i >= 0; i--) {
      if ((collapsedMessages[i].metadata as any)?.folded) {
        lastFoldedIndex = i;
        break;
      }
    }

    if (lastFoldedIndex !== -1) {
      collapsedMessages[lastFoldedIndex].metadata = {
        ...collapsedMessages[lastFoldedIndex].metadata,
        is_boundary: true
      };
    }

    return collapsedMessages;
 
  }

  getBudgetStatus(): string {
    return this.budget.getStatusReport();
  }
}
