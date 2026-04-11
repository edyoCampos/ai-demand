import OpenAI from 'openai';
import { ProviderAdapter, ProviderConfig, CallParams } from './types.js';
import { Message, AgentEvent } from '../types/message.js';
/**
 * OpenAIAdapter - Adaptador Base e Puro para provedores compatíveis com OpenAI.
 * Agora com Fallback de Estimativa de Tokens (Disruptivo).
 */
export declare class OpenAIAdapter implements ProviderAdapter {
    protected client: OpenAI;
    protected model: string;
    name: string;
    constructor(config: ProviderConfig);
    protected normalizeSchema(schema: any): any;
    protected adaptMessages(messages: Message[], systemPrompt?: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    call(params: CallParams): AsyncGenerator<AgentEvent>;
}
//# sourceMappingURL=openai.d.ts.map