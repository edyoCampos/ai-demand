import { Usage } from '../../types/message.js';
export interface BudgetConfig {
    maxPromptTokens: number;
    maxTotalTokens: number;
    compactionThreshold: number;
}
/**
 * TokenBudgetManager - Gerencia o orçamento de tokens da conversa.
 * Inspirado nos padrões de resiliência e 'StopHooks' do OpenClaude.
 */
export declare class TokenBudgetManager {
    private currentUsage;
    private config;
    constructor(config?: Partial<BudgetConfig>);
    updateUsage(usage: Usage): void;
    shouldCompact(): boolean;
    getPromptTokens(): number;
    getRemainingTokens(): number;
    getStatusReport(): string;
}
//# sourceMappingURL=tokenBudget.d.ts.map