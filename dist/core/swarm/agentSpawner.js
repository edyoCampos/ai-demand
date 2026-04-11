import { DemandAI } from '../kernel.js';
import { CapabilityRegistry } from '../registry.js';
/**
 * AgentSpawner - Fábrica de Agentes Especialistas (Fase 3).
 * Permite que o Kernel principal bife (spawns) sub-agentes com escopo limitado.
 * Inspirado nos padrões de 'Teammates' do OpenClaude.
 */
export class AgentSpawner {
    masterProvider;
    persistence;
    masterRegistry;
    constructor(masterProvider, persistence, masterRegistry) {
        this.masterProvider = masterProvider;
        this.persistence = persistence;
        this.masterRegistry = masterRegistry;
    }
    /**
     * Cria um Agente Sombra (Shadow Agent) para uma tarefa específica.
     */
    spawn(options) {
        // 1. Criar um registro de ferramentas filtrado (Least Privilege)
        const subRegistry = new CapabilityRegistry();
        if (options.tools) {
            for (const toolName of options.tools) {
                const tool = this.masterRegistry.getTool(toolName);
                if (tool)
                    subRegistry.registerTool(tool);
            }
        }
        else {
            // Por padrão, sub-agentes tem acesso a todas as ferramentas do mestre
            // mas na arquitetura industrial, o ideal é limitar.
            for (const tool of this.masterRegistry.getAllTools()) {
                subRegistry.registerTool(tool);
            }
        }
        // 2. Definir o System Prompt do Especialista
        const systemPrompt = options.specializedPrompt ||
            `You are a specialized ${options.agentType} agent assigned to: ${options.task}. 
       Operate within the provided context and respond with a concise execution transcript.`;
        // 3. Instanciar o Sub-Agente vinculado à sessão pai
        return new DemandAI({
            provider: this.masterProvider,
            registry: subRegistry,
            persistence: this.persistence, // Compartilha a mesma persistência ( Postgres sabe lidar via conversation_id )
            systemPrompt,
            maxTurns: 5, // Sub-agentes são geralmente mais curtos
            maxTokensPerTurn: 50000
        });
    }
}
//# sourceMappingURL=agentSpawner.js.map