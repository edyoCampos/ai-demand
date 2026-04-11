import { DemandAI } from '../kernel.js';
import { CapabilityRegistry } from '../registry.js';
import { PersistenceAdapter } from '../persistence.js';
import { ProviderAdapter } from '../../providers/types.js';
/**
 * AgentSpawner - Fábrica de Agentes Especialistas (Fase 3).
 * Permite que o Kernel principal bife (spawns) sub-agentes com escopo limitado.
 * Inspirado nos padrões de 'Teammates' do OpenClaude.
 */
export declare class AgentSpawner {
    private masterProvider;
    private persistence;
    private masterRegistry;
    constructor(masterProvider: ProviderAdapter, persistence: PersistenceAdapter, masterRegistry: CapabilityRegistry);
    /**
     * Cria um Agente Sombra (Shadow Agent) para uma tarefa específica.
     */
    spawn(options: {
        agentType: string;
        task: string;
        parentSessionId: string;
        subSessionId: string;
        specializedPrompt?: string;
        tools?: string[];
    }): DemandAI;
}
//# sourceMappingURL=agentSpawner.d.ts.map