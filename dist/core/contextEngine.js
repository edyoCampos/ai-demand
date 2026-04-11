import { TokenBudgetManager } from './utils/tokenBudget.js';
import { ContextFolder } from './utils/folding.js';
/**
 * ContextEngine - Orquestrador de Contexto Disruptivo.
 * Esta é a peça central da Fase 1, responsável por aplicar inteligência
 * de compactação e gestão de budget antes de cada inferência.
 */
export class ContextEngine {
    budget;
    folder;
    constructor(maxTokens) {
        this.budget = new TokenBudgetManager({ maxPromptTokens: maxTokens });
        this.folder = new ContextFolder();
    }
    /**
     * Prepara o histórico para o Provedor.
     * Aplica folding se o orçamento estiver apertado.
     */
    prepare(history, lastUsage) {
        if (lastUsage) {
            this.budget.updateUsage(lastUsage);
        }
        if (this.budget.shouldCompact()) {
            return this.folder.fold(history);
        }
        // Mesmo que não precise compactar por budget total, podemos aplicar folding 
        // seletivo em mensagens individuais gigantescas para economia proativa.
        return this.folder.fold(history);
    }
    getBudgetStatus() {
        return this.budget.getStatusReport();
    }
}
//# sourceMappingURL=contextEngine.js.map