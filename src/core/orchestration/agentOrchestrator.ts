import crypto from 'crypto';
import { DemandAI } from '../kernel.js';
import { CapabilityRegistry } from '../registry.js';
import { PersistenceAdapter } from '../persistence.js';
import { ProviderAdapter } from '../../providers/types.js';
import { BufferedPersistence } from '../utils/bufferedPersistence.js';

/**
 * AgentOrchestrator - Fábrica de Agentes Especialistas (Fase 3).
 * Permite que o Kernel principal instancie sub-agentes com escopo limitado.
 */
export class AgentOrchestrator {
  constructor(
    private masterProvider: ProviderAdapter,
    private persistence: PersistenceAdapter,
    private masterRegistry: CapabilityRegistry
  ) {}

  /**
   * Cria um Sub-Agente para uma tarefa específica.
   */
  async orchestrate(options: { 
    agentType: string;
    task: string;
    parentSessionId: string;
    subSessionId: string;
    context: string;
    parentDepth: number;
    specializedPrompt?: string;
    tools?: string[];
  }): Promise<DemandAI> {
    
    // 0. Enforce recursion limit (Audit V3 - In-memory strict check)
    const MAX_DEPTH = 2; // Limite industrial: máximo 2 níveis de delegação
    const currentDepth = (options.parentDepth || 0) + 1;

    if (currentDepth > MAX_DEPTH) {
      throw new Error(`RECURSION_SECURITY_LIMIT: Maximum orchestration depth (${MAX_DEPTH}) reached. Delegation denied.`);
    }

    // 3. Protocolo de Suavização de Orquestração (Anti-Collision Jitter)
    // Evita que Orquestrador e Especialistas batam no Rate Limit simultaneamente.
    const jitter = Math.floor(Math.random() * 500) + 200;
    await new Promise(resolve => setTimeout(resolve, jitter));

    const subRegistry = new CapabilityRegistry();
    if (options.tools) {
      for (const toolName of options.tools) {
        const tool = this.masterRegistry.getTool(toolName);
        if (tool) subRegistry.registerTool(tool);
      }
    } else {
      // Por padrão, sub-agentes tem acesso a todas as ferramentas do mestre
      // mas na arquitetura industrial, o ideal é limitar.
      for (const tool of this.masterRegistry.getAllTools()) {
        subRegistry.registerTool(tool);
      }
    }

    // 2. Definir o System Prompt (Audit V2 - Item 2.2 Transparency)
    const systemPrompt = `Specialist execution for task: ${options.task}. Use provided context and tools.`;

    // 3. Instanciar o Sub-Agente com Persistência em Buffer (Audit V2 - Item 5.1)
    const bufferedPersistence = new BufferedPersistence(this.persistence);
    
    // Injetar contexto no ID correto (subSessionId) para visibilidade imediata
    await bufferedPersistence.saveMessages(options.subSessionId, [{
       role: 'system',
       content: `TASK CONTEXT: ${options.context}`,
       metadata: { 
         is_boundary: true, 
         id: crypto.randomUUID(),
         orchestration_depth: currentDepth 
       }
    }]);

    const subAgent = new DemandAI({
      provider: this.masterProvider,
      registry: subRegistry,
      persistence: bufferedPersistence, 
      systemPrompt,
      maxTurns: 5,
      maxTokensPerTurn: 50000,
      agentType: options.agentType,
      orchestrationDepth: currentDepth 
    });

    return subAgent;
  }
}
