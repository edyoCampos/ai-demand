import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from '../core/utils/zodToSchema.js';
import { sanitizeSchema } from '../core/utils/schemaSanitizer.js';
import { addCacheBreakpoints } from '../core/utils/caching.js';
export class AnthropicAdapter {
    name = 'anthropic';
    client;
    model;
    constructor(config) {
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: config.timeout || 60000
        });
        this.model = config.model || 'claude-3-5-sonnet-20241022';
    }
    adaptMessages(messages) {
        return messages.map(msg => {
            if (Array.isArray(msg.content)) {
                return {
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content.map(c => {
                        if (c.type === 'text')
                            return { type: 'text', text: c.text };
                        if (c.type === 'tool_use')
                            return {
                                type: 'tool_use',
                                id: c.id,
                                name: c.name,
                                input: c.input
                            };
                        if (c.type === 'tool_result')
                            return {
                                type: 'tool_result',
                                tool_use_id: c.tool_use_id,
                                content: c.content,
                                is_error: c.is_error
                            };
                        return { type: 'text', text: '' };
                    })
                };
            }
            return {
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            };
        });
    }
    adaptTools(tools) {
        return tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: sanitizeSchema(t.jsonSchema || zodToJsonSchema(t.inputSchema))
        }));
    }
    async *call(params) {
        const cachedMessages = addCacheBreakpoints(params.messages);
        const stream = await this.client.messages.stream({
            model: params.modelOverride || this.model,
            max_tokens: params.maxTokens || 4096,
            messages: this.adaptMessages(cachedMessages),
            system: params.systemPrompt ? [{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }] : undefined,
            tools: this.adaptTools(params.tools).length > 0 ? this.adaptTools(params.tools) : undefined,
            temperature: params.temperature,
        }, { signal: params.signal });
        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield { type: 'text_delta', text: event.delta.text };
            }
            else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
                // Tool use accumulation is handled by the SDK stream helper
            }
            else if (event.type === 'message_delta') {
                if (event.usage) {
                    const inputTokens = event.usage.input_tokens || 0;
                    const outputTokens = event.usage.output_tokens || 0;
                    yield {
                        type: 'usage',
                        usage: {
                            prompt_tokens: inputTokens,
                            completion_tokens: outputTokens,
                            total_tokens: inputTokens + outputTokens
                        }
                    };
                }
            }
        }
        // Final tool calls are available after the stream at finalMessage
        const finalMsg = await stream.finalMessage();
        for (const block of finalMsg.content) {
            if (block.type === 'tool_use') {
                yield {
                    type: 'tool_call',
                    id: block.id,
                    name: block.name,
                    input: block.input
                };
            }
        }
        yield { type: 'stop', reason: 'end_turn' };
    }
}
//# sourceMappingURL=anthropic.js.map