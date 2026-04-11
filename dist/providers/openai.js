import OpenAI from 'openai';
import { zodToJsonSchema } from '../core/utils/zodToJsonSchema.js';
import { estimateTokens, estimateMessageTokens } from '../core/utils/token.js';
/**
 * OpenAIAdapter - Adaptador Base e Puro para provedores compatíveis com OpenAI.
 * Agora com Fallback de Estimativa de Tokens (Disruptivo).
 */
export class OpenAIAdapter {
    client;
    model;
    name = 'openai';
    constructor(config) {
        const baseUrl = config.baseUrl?.replace(/\/+$/, '');
        this.client = new OpenAI({
            apiKey: config.apiKey || 'no-key',
            baseURL: baseUrl,
            defaultHeaders: { 'x-goog-api-key': config.apiKey || '' },
            timeout: config.timeout || 60000
        });
        this.model = config.model || 'gpt-4o-mini';
    }
    normalizeSchema(schema) {
        if (!schema || typeof schema !== 'object')
            return schema;
        const r = { ...schema };
        if (r.type === 'object' && r.properties) {
            const p = { ...r.properties };
            const np = {};
            for (const k in p)
                np[k] = this.normalizeSchema(p[k]);
            r.properties = np;
            if (Array.isArray(r.required))
                r.required = r.required.filter((k) => k in np);
            r.additionalProperties = false;
        }
        delete r.$schema;
        delete r.additionalItems;
        delete r.definitions;
        return r;
    }
    adaptMessages(messages, systemPrompt) {
        const adapted = [];
        if (systemPrompt)
            adapted.push({ role: 'system', content: systemPrompt });
        for (const msg of messages) {
            if (typeof msg.content === 'string') {
                adapted.push({ role: msg.role, content: msg.content });
            }
            else if (Array.isArray(msg.content)) {
                const tCalls = [];
                const tParts = [];
                for (const b of msg.content) {
                    if (b.type === 'text')
                        tParts.push(b.text);
                    else if (b.type === 'tool_use') {
                        tCalls.push({
                            id: b.id,
                            type: 'function',
                            function: {
                                name: b.name,
                                arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input)
                            }
                        });
                    }
                    else if (b.type === 'tool_result') {
                        adapted.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content || '' });
                    }
                }
                const text = tParts.join('\n');
                const role = msg.role;
                if (role === 'assistant' && tCalls.length > 0)
                    adapted.push({ role: 'assistant', content: text || null, tool_calls: tCalls });
                else if (text)
                    adapted.push({ role, content: text });
            }
        }
        return adapted;
    }
    async *call(params) {
        const adaptedMessages = this.adaptMessages(params.messages, params.systemPrompt);
        // Preparar estimativa de Prompt (Input)
        const promptTokensGuess = estimateMessageTokens(params.messages) + (params.systemPrompt ? estimateTokens(params.systemPrompt) : 0);
        let completionTokensGuess = 0;
        let receivedUsage = false;
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
                stream_options: { include_usage: true }, // Tenta forçar o usage para provedores que suportam
                temperature: params.temperature
            }, { signal: params.signal });
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
                        completionTokensGuess += estimateTokens(tc.function?.name || '') + estimateTokens(tc.function?.arguments || '');
                        if (tc.function?.name)
                            yield { type: 'tool_call', id: tc.id || '', name: tc.function.name, input: tc.function.arguments || '{}' };
                    }
                }
                if (chunk.choices?.[0]?.finish_reason) {
                    const fr = chunk.choices[0].finish_reason;
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
        }
        catch (e) {
            yield { type: 'error', error: e.response?.data ? JSON.stringify(e.response.data) : e.message };
        }
    }
}
//# sourceMappingURL=openai.js.map