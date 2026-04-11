import { OpenAIAdapter } from './openai.js';
import { Message } from '../types/message.js';
import { ProviderConfig } from './types.js';
import OpenAI from 'openai';
/**
 * GeminiAdapter - Especializado para o Google Gemini via API OpenAI (v1beta).
 * Resolve inconsistências de roles e assinaturas de pensamento (Erro 400).
 * Integra suporte à 'Thinking Block' do modelo Gemini 2.0.
 */
export declare class GeminiAdapter extends OpenAIAdapter {
    constructor(config: ProviderConfig);
    /**
     * Sobrescreve a adaptação de mensagens para injetar o 'thought_signature'
     * e garantir a alternância perfeita exigida pelo Google.
     */
    protected adaptMessages(messages: Message[], systemPrompt?: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}
//# sourceMappingURL=gemini.d.ts.map