import { ProviderAdapter } from '../providers/types.js';
import { CapabilityRegistry } from './registry.js';
import { PersistenceAdapter } from './persistence.js';
import { AgentEvent } from '../types/message.js';
import { HookManager } from './hooks.js';
export interface AgentConfig {
    provider: ProviderAdapter;
    registry?: CapabilityRegistry;
    persistence?: PersistenceAdapter;
    hooks?: HookManager;
    systemPrompt?: string;
    maxTurns?: number;
    maxTokensPerTurn?: number;
    maxHistoryMessages?: number;
    temperature?: number;
}
/**
 * demandAI - The core autonomous agent kernel.
 * Universal, resilient, and professional.
 */
export declare class DemandAI {
    private provider;
    registry: CapabilityRegistry;
    private persistence;
    private hooks;
    private systemPrompt;
    private maxTurns;
    private maxTokensPerTurn;
    private maxHistoryMessages;
    private temperature?;
    private context;
    private activeLocks;
    private sessionUsage;
    constructor(config: AgentConfig);
    private updateHistory;
    ask(conversationId: string, userMessage: string, options?: {
        signal?: AbortSignal;
    }): AsyncGenerator<AgentEvent>;
}
//# sourceMappingURL=kernel.d.ts.map