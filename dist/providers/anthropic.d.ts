import { ProviderAdapter, CallParams, ProviderConfig } from './types.js';
import { AgentEvent } from '../types/message.js';
export declare class AnthropicAdapter implements ProviderAdapter {
    readonly name = "anthropic";
    private client;
    private model;
    constructor(config: ProviderConfig);
    private adaptMessages;
    private adaptTools;
    call(params: CallParams): AsyncGenerator<AgentEvent>;
}
//# sourceMappingURL=anthropic.d.ts.map