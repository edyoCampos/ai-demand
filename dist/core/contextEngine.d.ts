import { Message, Usage } from '../types/message.js';
/**
 * ContextEngine - Orquestrador de Contexto Disruptivo.
 * Esta é a peça central da Fase 1, responsável por aplicar inteligência
 * de compactação e gestão de budget antes de cada inferência.
 */
export declare class ContextEngine {
    private budget;
    private folder;
    constructor(maxTokens?: number);
    /**
     * Prepara o histórico para o Provedor.
     * Aplica folding se o orçamento estiver apertado.
     */
    prepare(history: Message[], lastUsage?: Usage): Message[];
    getBudgetStatus(): string;
}
//# sourceMappingURL=contextEngine.d.ts.map