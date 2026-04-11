import { ProviderAdapter, CallParams } from '../../providers/types.js';
import { AgentEvent } from '../../types/message.js';
import { ModelInventory, ReasoningCapacity } from './ModelInventory.js';
import { PersistenceAdapter } from '../persistence.js';

export interface AdaptiveConfig {
  inventory: ModelInventory;
  preferredProvider?: string;
  localProvider: ProviderAdapter; // Fallback garantido (Ollama)
  cloudProviders: Map<string, ProviderAdapter>;
  persistence?: PersistenceAdapter; // Memória de saúde (Cross-process)
}

/**
 * Local de armazenamento para estado de saúde dos provedores (Circuito Breaker).
 */
const PROVIDER_BLACKLIST = new Map<string, { until: number; reason: string }>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos de "geladeira"

/**
 * AdaptiveProvider - O Proxy de Roteamento Inteligente.
 * Implementa a interface ProviderAdapter mas seleciona o recurso ideal 
 * baseado na complexidade da tarefa e disponibilidade.
 */
export class AdaptiveProvider implements ProviderAdapter {
  public name = 'adaptive-orchestrator';

  constructor(private config: AdaptiveConfig) {}

  async *call(params: CallParams): AsyncGenerator<AgentEvent> {
    const requiredCapacity = (params as any).requiredCapacity || ReasoningCapacity.STANDARD;
    
    // Sincronizar Blacklist com a Persistência (Memória de Saúde)
    if (this.config.persistence) {
      const persistedBlacklist = await this.config.persistence.loadMetadata('provider_health');
      if (persistedBlacklist && typeof persistedBlacklist === 'object') {
        for (const [p, entry] of Object.entries(persistedBlacklist)) {
          if ((entry as any).until > Date.now()) {
            PROVIDER_BLACKLIST.set(p, entry as any);
          }
        }
      }
    }

    let attempt = 0;
    const maxCloudRetries = 2; // Tentar até 2 provedores cloud diferentes se necessário

    while (attempt <= maxCloudRetries) {
      // 1. Identificar provedores que estão no "castigo" agora
      const blacklisted = Array.from(PROVIDER_BLACKLIST.entries())
        .filter(([_, entry]) => Date.now() < entry.until)
        .map(([p]) => p);

      // 2. Tentar encontrar o melhor recurso disponível ignorando os bloqueados
      let selectedResource = this.config.inventory.getBestResource(requiredCapacity, blacklisted);
      
      // 3. Limpeza de expirações da blacklist (housekeeping)
      for (const [p, entry] of PROVIDER_BLACKLIST.entries()) {
        if (Date.now() >= entry.until) {
          PROVIDER_BLACKLIST.delete(p);
        }
      }

      // 4. Se não houver recurso Cloud disponível, vai pro Local
      if (!selectedResource || (requiredCapacity === ReasoningCapacity.BASIC && selectedResource.provider !== 'ollama')) {
        yield* this.config.localProvider.call(params);
        return;
      }

      const adapter = this.config.cloudProviders.get(selectedResource.provider) || this.config.localProvider;
      console.log(`[AdaptiveRouter] Tentativa ${attempt + 1}: Provedor ${selectedResource.provider}, Modelo: ${selectedResource.id}`);

      try {
        const effectiveParams: CallParams = { 
          ...params, 
          modelOverride: selectedResource.id 
        };

        const stream = adapter.call(effectiveParams);
        let receivedAnyChunk = false;

        for await (const event of stream) {
          if (event.type === 'error') {
             const isRateLimit = event.error.includes('429') || event.error.includes('limit');
             if (isRateLimit) {
               console.warn(`[AdaptiveRouter] Provedor ${selectedResource.provider} indisponível (429). Blacklisting...`);
               const entry = { until: Date.now() + COOLDOWN_MS, reason: 'Rate Limit' };
               PROVIDER_BLACKLIST.set(selectedResource.provider, entry);
               
               // Persistir novo estado de saúde
               if (this.config.persistence) {
                 await this.config.persistence.saveMetadata('provider_health', Object.fromEntries(PROVIDER_BLACKLIST));
               }
               
               if (!receivedAnyChunk) {
                 attempt++;
                 break; 
               }
             }
             yield event;
             return;
          }
          receivedAnyChunk = true;
          yield event;
        }
        
        // Se o for await terminou sem break/return, a execução foi um sucesso (concluiu o stream)
        if (receivedAnyChunk) return;

      } catch (e: any) {
        console.error(`[AdaptiveRouter] Falha no adaptador ${selectedResource.provider}:`, e.message);
        PROVIDER_BLACKLIST.set(selectedResource.provider, { until: Date.now() + COOLDOWN_MS, reason: e.message });
        attempt++;
        if (attempt > maxCloudRetries) {
          yield* this.config.localProvider.call(params);
          return;
        }
      }
    }

    // Fallback final se o loop de tentativas cloud falhar
    yield* this.config.localProvider.call(params);
  }

  /**
   * Retorna o adaptador local diretamente (útil para tarefas de infraestrutura).
   */
  public getLocalSync(): ProviderAdapter {
    return this.config.localProvider;
  }

  async embed(text: string): Promise<number[]> {
    // Embeddings prioriza Local por latência e privacidade, a menos que indisponível
    try {
      return await this.config.localProvider.embed(text);
    } catch {
      // Se local falhar, tenta o primeiro cloud disponível
      const firstCloud = Array.from(this.config.cloudProviders.values())[0];
      if (firstCloud) return firstCloud.embed(text);
      throw new Error("Nenhum provedor de embedding disponível.");
    }
  }
}
