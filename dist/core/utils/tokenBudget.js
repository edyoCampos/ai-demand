/**
 * TokenBudgetManager - Gerencia o orçamento de tokens da conversa.
 * Inspirado nos padrões de resiliência e 'StopHooks' do OpenClaude.
 */
export class TokenBudgetManager {
    currentUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    config;
    constructor(config = {}) {
        this.config = {
            maxPromptTokens: config.maxPromptTokens || 128000, // Padrão Claude 3.x
            maxTotalTokens: config.maxTotalTokens || 200000,
            compactionThreshold: config.compactionThreshold || 0.75, // Dispara aos 75% do limite
        };
    }
    updateUsage(usage) {
        this.currentUsage.prompt_tokens = usage.prompt_tokens;
        this.currentUsage.completion_tokens = usage.completion_tokens;
        this.currentUsage.total_tokens = usage.total_tokens;
    }
    shouldCompact() {
        const usageRatio = this.currentUsage.prompt_tokens / this.config.maxPromptTokens;
        return usageRatio >= this.config.compactionThreshold;
    }
    getPromptTokens() {
        return this.currentUsage.prompt_tokens;
    }
    getRemainingTokens() {
        return this.config.maxPromptTokens - this.currentUsage.prompt_tokens;
    }
    getStatusReport() {
        const ratio = (this.currentUsage.prompt_tokens / this.config.maxPromptTokens) * 100;
        return `Context Usage: ${this.currentUsage.prompt_tokens} tokens (${ratio.toFixed(1)}% of budget)`;
    }
}
//# sourceMappingURL=tokenBudget.js.map