import { ProviderAdapter, ProviderConfig } from './types.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GeminiAdapter } from './gemini.js';
import { ModelInventory, ModelResource } from '../core/resource/ModelInventory.js';
import { AdaptiveProvider } from '../core/resource/AdaptiveProvider.js';
import { PersistenceAdapter } from '../core/persistence.js';

/**
 * ProviderManager - Gerenciador de Ciclo de Vida de Provedores.
 * Agora integrado com o ModelInventory para orquestração adaptativa.
 */
export class ProviderManager {
  private static inventory: ModelInventory = new ModelInventory();

  /**
   * Cria uma instância do adaptador baseada no nome do provedor.
   */
  static create(providerName: string, config: ProviderConfig): ProviderAdapter {
    const name = providerName.toLowerCase();
    
    switch (name) {
      case 'anthropic':
      case 'claude':
        return new AnthropicAdapter(config);
      
      case 'gemini':
      case 'google':
        return new GeminiAdapter(config);
      
      case 'openai':
      case 'gpt':
      case 'groq':
      case 'deepseek':
      case 'ollama':
      case 'localai':
      case 'mistral':
      case 'together':
      case 'xai':
      case 'grok':
        return new OpenAIAdapter(config);
        
      default:
        if (config.baseUrl) return new OpenAIAdapter(config);
        throw new Error(`Provedor desconhecido: ${providerName}`);
    }
  }

  /**
   * Inicializa o Adaptive Resource Management.
   * Detecta chaves de API e configura o pool de recursos (Local + Cloud).
   */
  static createAdaptive(persistence?: PersistenceAdapter): AdaptiveProvider {
    const cloudProviders = new Map<string, ProviderAdapter>();
    
    // 1. Configurar Provedor Local (Ollama)
    const localAdapter = this.create('ollama', {
      name: 'ollama',
      apiKey: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      model: process.env.OLLAMA_MODEL || 'llama3.2'
    });

    this.inventory.registerResource({
      id: process.env.OLLAMA_MODEL || 'llama3.2',
      name: 'Local Worker',
      provider: 'ollama',
      capacity: ModelInventory.classifyModel(process.env.OLLAMA_MODEL || 'llama3.2'),
      supportsTools: true
    });

    // 2. Tentar Configurar Google (se houver key)
    if (process.env.GOOGLE_API_KEY) {
      const googleModel = process.env.GOOGLE_MODEL || process.env.LLM_MODEL || 'gemini-2.0-flash';
      const gAdapter = this.create('google', {
        name: 'google',
        apiKey: process.env.GOOGLE_API_KEY,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: googleModel
      });
      cloudProviders.set('google', gAdapter);
      this.inventory.registerResource({
        id: googleModel,
        name: 'Google Cloud Power',
        provider: 'google',
        capacity: ModelInventory.classifyModel(googleModel),
        supportsTools: true
      });
    }

    // 3. Tentar Configurar Groq (se houver key)
    if (process.env.GROQ_API_KEY) {
      const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      const groqAdapter = this.create('groq', {
        name: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        baseUrl: 'https://api.groq.com/openai/v1',
        model: groqModel
      });
      cloudProviders.set('groq', groqAdapter);
      this.inventory.registerResource({
        id: groqModel,
        name: 'Groq High Speed',
        provider: 'groq',
        capacity: ModelInventory.classifyModel(groqModel),
        supportsTools: true
      });
    }

    return new AdaptiveProvider({
      inventory: this.inventory,
      localProvider: localAdapter,
      cloudProviders,
      persistence // Memória de saúde (Persistent Circuit Breaker)
    });
  }

  static fromEnv(persistence?: PersistenceAdapter): ProviderAdapter {
    // Se o usuário não informar nada, o modo ADAPTIVE é o novo padrão industrial do DemandAI
    return this.createAdaptive(persistence);
  }

  static getEmbeddingProvider(): ProviderAdapter {
    // Para embeddings, priorizamos local se possível
    const provider = process.env.EMBEDDING_PROVIDER || 'ollama';
    return this.createFromEnv(provider, 'EMBEDDING');
  }

  private static createFromEnv(provider: string, prefix: string): ProviderAdapter {
    const p = provider.toUpperCase();
    const pref = prefix.toUpperCase();
    
    // Prioridade absoluta: Nome do Provedor (ex: OLLAMA_API_KEY)
    const apiKey = process.env[`${p}_API_KEY`] || process.env[`${pref}_API_KEY`] || process.env.LLM_API_KEY || '';
    let baseUrl = process.env[`${p}_BASE_URL`] || process.env[`${pref}_BASE_URL`] || process.env.LLM_BASE_URL;
    const model = process.env[`${p}_MODEL`] || process.env[`${pref}_MODEL`] || process.env.LLM_MODEL;

    // Fallback de BaseURL para Provedores Locais se não configurado
    if (!baseUrl) {
      if (provider === 'ollama') baseUrl = 'http://localhost:11434/v1';
      if (provider === 'localai') baseUrl = 'http://localhost:8080/v1';
    }

    const defaultLocalModel = provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini';

    return this.create(provider, {
      name: provider, // Injetar o nome real para o adaptador
      apiKey: apiKey.trim(),
      baseUrl: baseUrl?.trim(),
      model: (model || defaultLocalModel).trim(),
      temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
    });
  }
}
