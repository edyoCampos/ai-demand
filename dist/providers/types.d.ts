import { Message, AgentEvent } from '../types/message.js';
import { Tool } from '../core/tool.js';
export interface ProviderConfig {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    timeout?: number;
    temperature?: number;
}
export interface CallParams {
    messages: Message[];
    tools: Tool[];
    systemPrompt?: string;
    maxTokens?: number;
    modelOverride?: string;
    signal?: AbortSignal;
    temperature?: number;
}
export interface ProviderAdapter {
    readonly name: string;
    call(params: CallParams): AsyncGenerator<AgentEvent>;
}
//# sourceMappingURL=types.d.ts.map