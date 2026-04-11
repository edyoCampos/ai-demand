import { OpenAIAdapter } from './openai.js';
import { Message, AgentEvent } from '../types/message.js';
import { CallParams, ProviderConfig } from './types.js';
import { normalizeMessagesForAPI } from '../core/utils/normalization.js';
import { zodToJsonSchema } from '../core/utils/zodToSchema.js';
import OpenAI from 'openai';

/**
 * GeminiAdapter - Especializado para o Google Gemini via API OpenAI (v1beta).
 * Resolve inconsistências de roles e assinaturas de pensamento (Erro 400).
 * Integra suporte à 'Thinking Block' do modelo Gemini 2.0.
 */
export class GeminiAdapter extends OpenAIAdapter {
  constructor(config: ProviderConfig) {
    super(config);
    this.name = 'gemini';
    
    // Google API Key Injection (OpenAI Compatibility Layer)
    // O Google exige 'x-goog-api-key' ou o parâmetro 'key' na URL.
    const baseUrl = config.baseUrl?.replace(/\/+$/, '');
    
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: baseUrl,
      defaultHeaders: { 
        'x-goog-api-key': config.apiKey || '',
      },
      defaultQuery: { 'key': config.apiKey || '' }, // Crítico para evitar 404/403 no v1beta
      dangerouslyAllowBrowser: true 
    });
  }

  /**
   * Sobrescreve a call para remover 'stream_options' que o Google Scaffolding não suporta.
   */
  async *call(params: CallParams): AsyncGenerator<AgentEvent> {
    const adaptedMessages = this.adaptMessages(params.messages, params.systemPrompt);
    
    try {
      const stream = await this.client.chat.completions.create({
        model: params.modelOverride || this.model,
        messages: adaptedMessages,
        tools: params.tools.length ? params.tools.map(t => ({ 
          type: 'function', 
          function: { 
            name: t.name, 
            description: t.description, 
            parameters: this.normalizeSchema(t.jsonSchema || zodToJsonSchema(t.inputSchema)) 
          } 
        })) : undefined,
        stream: true,
        // stream_options removido: Causa 404 no endpoint de compatibilidade do Gemini
        temperature: params.temperature
      }, { signal: params.signal });

      for await (const chunk of stream as any) {
        const d = chunk.choices?.[0]?.delta;
        if (d?.content) {
          yield { type: 'text_delta', text: d.content };
        }
        
        if (d?.tool_calls) {
          for (const tc of d.tool_calls) {
            yield { type: 'tool_call', id: tc.id, name: tc.function?.name || '', input: tc.function?.arguments || '{}' };
          }
        }
        
        if (chunk.choices?.[0]?.finish_reason) {
          yield { type: 'stop', reason: 'end_turn' };
        }
      }
    } catch (e: any) {
      yield { type: 'error', error: e.message };
    }
  }

  /**
   * Sobrescreve a adaptação de mensagens para injetar folding e garantir 
   * a alternância perfeita exigida pelo Google.
   */
  protected override adaptMessages(messages: Message[], systemPrompt?: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const rawAdapted: any[] = [];
    
    // 1. Fase de Extração e Injeção de Sistema
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      let text = '';
      const tCalls: any[] = [];

      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b.type === 'text') text += (text ? '\n' : '') + b.text;
          else if (b.type === 'thinking') text = `<thought>\n${b.thinking}\n</thought>\n\n${text}`;
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
             rawAdapted.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content || '' });
          }
        }
      }

      // Injeção de System Prompt via Role: System
      if (i === 0 && systemPrompt) {
        rawAdapted.push({ role: 'system', content: systemPrompt });
      }

      const role = msg.role as any;
      
      if (role !== 'tool' && role !== 'system') {
        // Formato Gemini OpenAI-compatible exige content string ou null para tool_calls
        rawAdapted.push({ 
          role, 
          content: text || '', 
          tool_calls: tCalls.length > 0 ? tCalls : undefined 
        });
      }
    }

    // 2. Fase de Folding (Colapso de Roles Consecutivos) - CRÍTICO PARA GEMINI
    const folded: any[] = [];
    for (const msg of rawAdapted) {
      const last = folded[folded.length - 1];
      
      if (last && last.role === msg.role && msg.role !== 'tool') {
        const textToAppend = typeof msg.content === 'string' ? msg.content : '';
        if (textToAppend) {
          last.content = (typeof last.content === 'string' ? last.content : '') + '\n\n' + textToAppend;
        }
        if (msg.tool_calls) last.tool_calls = [...(last.tool_calls || []), ...msg.tool_calls];
      } else {
        folded.push(msg);
      }
    }

    return folded;
  }
}
