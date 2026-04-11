import OpenAI from 'openai';
import { ProviderAdapter, ProviderConfig, CallParams } from './types.js';
import { Message, AgentEvent } from '../types/message.js';
import { zodToJsonSchema } from '../core/utils/zodToSchema.js';
import { estimateTokens, estimateMessageTokens } from '../core/utils/token.js';

/**
 * OpenAIAdapter - Base adapter for OpenAI-compatible APIs (DemandAI Core).
 * Agora com Fallback de Estimativa de Tokens (Disruptivo).
 */
export class OpenAIAdapter implements ProviderAdapter {
  protected client: OpenAI;
  protected model: string;
  public name = 'openai';

  constructor(config: ProviderConfig) {
    const baseUrl = config.baseUrl?.replace(/\/+$/, '');
    const isGoogle = this.name.includes('google') || this.name.includes('gemini') || (baseUrl?.includes('google'));
    
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: baseUrl,
      defaultHeaders: isGoogle ? { 'x-goog-api-key': config.apiKey || '' } : {},
      timeout: config.timeout || 300000, // 5 minutos
      maxRetries: 5 
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  protected normalizeSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;
    const r = { ...schema };
    if (r.type === 'object' && r.properties) {
      const p = { ...r.properties };
      const np: any = {};
      for (const k in p) np[k] = this.normalizeSchema(p[k]);
      r.properties = np;
      
      // Validação Industrial (Gemini/OpenClaude Standard): 
      // Rejeitar campos no 'required' que não existem em 'properties' para evitar erro 400.
      if (Array.isArray(r.required)) {
        r.required = r.required.filter((k: string) => k in np);
      }
      
      r.additionalProperties = false;
    }
    delete r.$schema;
    delete r.additionalItems;
    delete r.definitions;
    return r;
  }

  protected adaptMessages(messages: Message[], systemPrompt?: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const adapted: any[] = [];
    if (systemPrompt) adapted.push({ role: 'system', content: systemPrompt });

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        adapted.push({ role: msg.role, content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const tCalls: any[] = [];
        const tParts: string[] = [];
        for (const b of msg.content) {
          if (b.type === 'text') tParts.push(b.text);
          else if (b.type === 'tool_use') {
            tCalls.push({ 
              id: b.id, 
              type: 'function', 
              function: { 
                name: b.name, 
                arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input) 
              } 
            });
          } else if (b.type === 'tool_result') {
            adapted.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content || '' });
          }
        }
        const text = tParts.join('\n');
        const role = msg.role as any;
        if (role === 'assistant' && tCalls.length > 0) adapted.push({ role: 'assistant', content: text || null, tool_calls: tCalls });
        else if (text) adapted.push({ role, content: text });
      }
    }
    return adapted;
  }

  async *call(params: CallParams): AsyncGenerator<AgentEvent> {
    const adaptedMessages = this.adaptMessages(params.messages, params.systemPrompt);
    
    // Preparar estimativa de Prompt (Input)
    const promptTokensGuess = estimateMessageTokens(params.messages) + (params.systemPrompt ? estimateTokens(params.systemPrompt) : 0);
    let completionTokensGuess = 0;
    let receivedUsage = false;
    
    // Aggregator para tool calls granulares
    const activeToolCalls = new Map<number, { id: string, name: string, arguments: string }>();

    const maxManualAttempts = 3;
    let attempt = 0;
    let stream: any;

    const currentModel = params.modelOverride || this.model;

    while (attempt < maxManualAttempts) {
      try {
        const tools = params.tools.length ? params.tools.map(t => {
          let parameters;
          try {
            parameters = this.normalizeSchema(t.jsonSchema || zodToJsonSchema(t.inputSchema));
          } catch (e) {
            console.warn(`[OpenAIAdapter] Falha ao converter esquema para ferramenta ${t.name}, enviando esquema vazio.`, e);
            parameters = { type: 'object', properties: {}, additionalProperties: false };
          }
          return { 
            type: 'function', 
            function: { 
              name: t.name, 
              description: t.description, 
              parameters 
            } 
          };
        }) : undefined;

        stream = await this.client.chat.completions.create({
          model: currentModel,
          messages: adaptedMessages,
          tools: tools as any,
          stream: true,
          stream_options: { include_usage: true },
          temperature: params.temperature
        }, { signal: params.signal });
        
        break;
        
      } catch (e: any) {
        attempt++;
        
        // AUTO-DOWNLOAD: Se o modelo não existir e o provedor for Ollama
        const isNotFound = e.status === 404 || e.message?.includes('not found');
        const isOllama = this.client.baseURL.includes('localhost') || this.client.baseURL.includes('11434') || this.name === 'ollama';

        if (isNotFound && isOllama && attempt === 1) {
          yield { type: 'text_delta', text: `\n\x1b[33m[Self-Healing] Modelo '${currentModel}' não encontrado. Iniciando download automático via Ollama...\x1b[0m\n` };
          try {
            await this.pullModel(currentModel);
            yield { type: 'text_delta', text: `\n\x1b[32m[Self-Healing] Download concluído. Retentando execução...\x1b[0m\n` };
            continue; // Tenta de novo com o modelo baixado
          } catch (pullErr: any) {
            console.error(`[Self-Healing] Falha ao baixar modelo: ${pullErr.message}`);
          }
        }

        throw e; 
      }
    }

    try {
      for await (const chunk of stream) {
        if (chunk.usage) {
          receivedUsage = true;
          yield { type: 'usage', usage: { 
            prompt_tokens: chunk.usage.prompt_tokens, 
            completion_tokens: chunk.usage.completion_tokens, 
            total_tokens: chunk.usage.total_tokens 
          } };
        }
        
        const d = chunk.choices?.[0]?.delta;
        if (d?.content) {
          completionTokensGuess += estimateTokens(d.content);
          yield { type: 'text_delta', text: d.content };
        }
        
        if (d?.tool_calls) {
          for (const tc of d.tool_calls) {
            const index = tc.index ?? 0;
            if (!activeToolCalls.has(index)) {
              activeToolCalls.set(index, { id: tc.id || '', name: tc.function?.name || '', arguments: '' });
            }
            const active = activeToolCalls.get(index)!;
            if (tc.function?.arguments) {
              active.arguments += tc.function.arguments;
            }
            completionTokensGuess += estimateTokens(tc.function?.name || '') + estimateTokens(tc.function?.arguments || '');
          }
        }
        
        if (chunk.choices?.[0]?.finish_reason) {
          const fr = chunk.choices[0].finish_reason;
          for (const [_, tc] of activeToolCalls) {
            yield { type: 'tool_call', id: tc.id, name: tc.name, input: tc.arguments || '{}' };
          }
          yield { type: 'stop', reason: fr === 'tool_calls' ? 'tool_use' : fr === 'length' ? 'max_turns' : 'end_turn' };
        }
      }

      // FALLBACK DISRUPTIVO: Se o stream terminou e não recebemos usage real, emitimos a estimativa
      if (!receivedUsage) {
        yield { 
          type: 'usage', 
          usage: { 
            prompt_tokens: promptTokensGuess, 
            completion_tokens: completionTokensGuess, 
            total_tokens: promptTokensGuess + completionTokensGuess 
          } 
        };
      }

    } catch (e: any) {
      yield { type: 'error', error: e.response?.data ? JSON.stringify(e.response.data) : e.message };
    }
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
      input: text.replace(/\n/g, ' '),
    });
    return res.data[0].embedding;
  }

  /**
   * Providencia o download automático do modelo via API do Ollama.
   */
  private async pullModel(modelName: string): Promise<void> {
    const pullUrl = `${this.client.baseURL.replace(/\/v1$/, '')}/api/pull`;
    const response = await fetch(pullUrl, {
      method: 'POST',
      body: JSON.stringify({ name: modelName, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Ollama Pull Error: ${response.statusText}`);
    }
  }
}
