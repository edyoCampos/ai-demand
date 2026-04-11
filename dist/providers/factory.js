import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GeminiAdapter } from './gemini.js';
export class ProviderFactory {
    /**
     * Cria uma instância do adaptador baseada no nome do provedor.
     * Registro explícito para máxima clareza e extensibilidade.
     */
    static create(providerName, config) {
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
                // Fallback para OpenAI se a URL estiver presente, senão erro.
                if (config.baseUrl)
                    return new OpenAIAdapter(config);
                throw new Error(`Provedor desconhecido: ${providerName}`);
        }
    }
    static fromEnv() {
        const provider = process.env.LLM_PROVIDER || 'anthropic';
        const specificKeyName = `${provider.toUpperCase()}_API_KEY`;
        // Chave é opcional para provedores locais
        const apiKey = process.env[specificKeyName] || process.env.LLM_API_KEY || '';
        const isLocal = ['ollama', 'lmstudio', 'localai'].includes(provider.toLowerCase());
        if (!apiKey && !isLocal) {
            throw new Error(`API key não definida para ${provider}. Configure ${specificKeyName} ou LLM_API_KEY.`);
        }
        const baseUrl = process.env.LLM_BASE_URL || process.env[`${provider.toUpperCase()}_BASE_URL`];
        // Abstração de Endpoints Padrão
        let finalBaseUrl = baseUrl;
        if (!finalBaseUrl) {
            const endpoints = {
                'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai',
                'google': 'https://generativelanguage.googleapis.com/v1beta/openai',
                'ollama': 'http://localhost:11434/v1',
                'localai': 'http://localhost:8080/v1',
                'groq': 'https://api.groq.com/openai/v1',
                'deepseek': 'https://api.deepseek.com',
                'mistral': 'https://api.mistral.ai/v1',
                'together': 'https://api.together.xyz/v1',
                'xai': 'https://api.x.ai/v1',
                'grok': 'https://api.x.ai/v1'
            };
            finalBaseUrl = endpoints[provider.toLowerCase()];
        }
        const model = process.env.LLM_MODEL || process.env[`${provider.toUpperCase()}_MODEL`];
        return ProviderFactory.create(provider, {
            apiKey,
            baseUrl: finalBaseUrl,
            model,
            timeout: process.env.LLM_TIMEOUT ? parseInt(process.env.LLM_TIMEOUT) : undefined,
            temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
        });
    }
}
//# sourceMappingURL=factory.js.map