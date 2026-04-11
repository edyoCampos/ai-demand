import { ProviderAdapter } from '../../providers/types.js';

export enum ReasoningCapacity {
  BASIC = 1,      // mini, flash, lite, 8b, gemma-it
  STANDARD = 2,   // 3.5, 70b, pro models without 'ultra' or 'reasoning'
  ADVANCED = 3,   // 4o, ultra, sonnet 3.5
  REASONING = 4,  // o1, o3, r1, deep-research, thinking models
}

export interface ModelResource {
  id: string;
  name: string;
  provider: string;
  capacity: ReasoningCapacity;
  supportsTools: boolean;
}

/**
 * ModelInventory - Gerenciador dinâmico de recursos de inferência.
 * Cataloga modelos disponíveis e os classifica por capacidade técnica.
 */
export class ModelInventory {
  private resources: ModelResource[] = [];

  /**
   * Registra um recurso manualmente (útil para modelos locais fixos).
   */
  public registerResource(resource: ModelResource) {
    this.resources.push(resource);
  }

  /**
   * Busca e cataloga modelos de um provedor ativo.
   */
  public async discover(providerName: string, adapter: ProviderAdapter): Promise<void> {
    try {
      // Nota: Implementação genérica de listagem dependeria de o adaptador expor 'listModels'.
      // Por enquanto, usaremos uma heurística baseada nos nomes comuns detectados.
      
      // Simulação de descoberta (em produção, isso seria uma chamada real ao endpoint /models)
      // Como o adaptador atual não expõe listModels na interface base, 
      // precisaremos expandir a interface no futuro ou fazer discovery via ProviderManager.
    } catch (e) {
      console.error(`[ModelInventory] Erro ao descobrir modelos para ${providerName}:`, e);
    }
  }

  /**
   * Retorna o melhor recurso disponível para uma determinada capacidade,
   * permitindo excluir provedores em "cooldown" (Blacklist).
   */
  public getBestResource(minCapacity: ReasoningCapacity, excludeProviders: string[] = []): ModelResource | undefined {
    return this.resources
      .filter(r => r.capacity >= minCapacity && !excludeProviders.includes(r.provider))
      .sort((a, b) => {
        // Primeiro por capacidade (descendente)
        if (b.capacity !== a.capacity) return b.capacity - a.capacity;
        // Depois prioriza Cloud sobre Local se capacidades forem iguais
        if (a.provider === 'ollama' && b.provider !== 'ollama') return 1;
        if (a.provider !== 'ollama' && b.provider === 'ollama') return -1;
        return 0;
      })[0];
  }

  /**
   * Classifica um modelo baseado em seu ID (Heurística Industrial).
   */
  public static classifyModel(modelId: string): ReasoningCapacity {
    const id = modelId.toLowerCase();
    
    if (id.includes('thinking') || id.includes('o1-') || id.includes('deep-research') || id.includes('r1')) {
      return ReasoningCapacity.REASONING;
    }
    if (id.includes('pro') || id.includes('ultra') || id.includes('4o') || id.includes('sonnet')) {
      return ReasoningCapacity.ADVANCED;
    }
    if (id.includes('70b') || id.includes('large') || id.includes('flash') || id.includes('gpt-4o-mini')) {
      return ReasoningCapacity.STANDARD;
    }
    return ReasoningCapacity.BASIC;
  }

  public getAllSync(): ModelResource[] {
    return this.resources;
  }
}
