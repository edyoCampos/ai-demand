import { CapabilityRegistry } from './registry.js';
import { MemoryPersistence } from './persistence.js';
import { HookManager } from './hooks.js';
import { withRetry } from './utils/resilience.js';
import { normalizeArguments, normalizeMessagesForAPI } from './utils/normalization.js';
import { ContextEngine } from './contextEngine.js';
import { Sanitizer } from './utils/sanitizer.js';
import { addCacheBreakpoints } from './utils/caching.js';
import { logError } from './utils/log.js';
/**
 * demandAI - The core autonomous agent kernel.
 * Universal, resilient, and professional.
 */
export class DemandAI {
    provider;
    registry;
    persistence;
    hooks;
    systemPrompt;
    maxTurns;
    maxTokensPerTurn;
    maxHistoryMessages;
    temperature;
    context;
    // Prevents multiple concurrent executions for the same conversationId
    activeLocks = new Set();
    sessionUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
    };
    constructor(config) {
        this.provider = config.provider;
        this.registry = config.registry || new CapabilityRegistry();
        this.persistence = config.persistence || new MemoryPersistence();
        this.hooks = config.hooks || new HookManager();
        this.systemPrompt = config.systemPrompt || 'You are a helpful assistant.';
        this.maxTurns = config.maxTurns || 10;
        this.maxTokensPerTurn = config.maxTokensPerTurn || 100000;
        this.maxHistoryMessages = config.maxHistoryMessages || 30;
        this.temperature = config.temperature;
        this.context = new ContextEngine(this.maxTokensPerTurn);
    }
    async updateHistory(conversationId, history, newMessage) {
        history.push(newMessage);
        await this.persistence.saveMessages(conversationId, history);
    }
    async *ask(conversationId, userMessage, options) {
        if (this.activeLocks.has(conversationId)) {
            yield { type: 'error', error: 'Concurrency error: Another process is already running for this conversation.' };
            return;
        }
        // Circuit Breaker State (Per Conversation Turn)
        const toolFailureCounters = new Map();
        try {
            this.activeLocks.add(conversationId);
            let history = await this.persistence.loadMessages(conversationId);
            if (userMessage) {
                await this.updateHistory(conversationId, history, { role: 'user', content: userMessage });
            }
            let turnCount = 0;
            let continueLoop = true;
            while (continueLoop && turnCount < this.maxTurns) {
                if (options?.signal?.aborted) {
                    break; // Stop iteration immediately, save partial history done in finally
                }
                if (this.sessionUsage.total_tokens > this.maxTokensPerTurn) {
                    yield { type: 'error', error: 'Token budget exceeded mid-stream.' };
                    break;
                }
                // PHASE 1: Context Folding & Token Budgeting (OpenClaude Standard)
                let currentHistory = this.context.prepare(history, this.sessionUsage);
                currentHistory = normalizeMessagesForAPI(currentHistory);
                currentHistory = addCacheBreakpoints(currentHistory);
                turnCount++;
                let hasToolCalls = false;
                const toolCalls = [];
                let assistantResponseContent = "";
                try {
                    const stream = this.provider.call({
                        messages: currentHistory,
                        tools: this.registry.getAllTools(),
                        systemPrompt: this.systemPrompt,
                        signal: options?.signal,
                        temperature: this.temperature
                    });
                    for await (const event of stream) {
                        if (options?.signal?.aborted) {
                            break; // Halts the stream immediately
                        }
                        if (event.type === 'text_delta') {
                            const sanitizedText = Sanitizer.sanitizeString(event.text);
                            assistantResponseContent += sanitizedText;
                            yield { type: 'text_delta', text: sanitizedText };
                        }
                        else {
                            yield event;
                        }
                        if (event.type === 'tool_call') {
                            hasToolCalls = true;
                            const tool = this.registry.getTool(event.name);
                            const normalizedInput = normalizeArguments(event.input, tool?.inputSchema);
                            toolCalls.push({ ...event, input: normalizedInput });
                        }
                        else if (event.type === 'usage') {
                            this.sessionUsage.prompt_tokens += event.usage.prompt_tokens;
                            this.sessionUsage.completion_tokens += event.usage.completion_tokens;
                            this.sessionUsage.total_tokens += event.usage.total_tokens;
                        }
                        else if (event.type === 'stop') {
                            if (event.reason === 'end_turn' && !hasToolCalls) {
                                continueLoop = false;
                            }
                        }
                    }
                }
                catch (error) {
                    yield { type: 'error', error: `Provider Error: ${error.message}` };
                    break;
                }
                if (hasToolCalls) {
                    await this.updateHistory(conversationId, history, {
                        role: 'assistant',
                        content: [
                            ...(assistantResponseContent ? [{ type: 'text', text: assistantResponseContent }] : []),
                            ...toolCalls.map(tc => ({
                                type: 'tool_use',
                                id: tc.id,
                                name: tc.name,
                                input: tc.input
                            }))
                        ]
                    });
                    const results = [];
                    for (const tc of toolCalls) {
                        const tool = this.registry.getTool(tc.name);
                        if (tool) {
                            const hookResult = await this.hooks.executeBeforeHooks(tool, tc.input);
                            if (hookResult.behavior === 'deny') {
                                results.push({
                                    type: 'tool_result',
                                    tool_use_id: tc.id,
                                    content: `Error: Denied. ${hookResult.reason || ''}`,
                                    is_error: true
                                });
                                continue;
                            }
                            try {
                                const result = await withRetry(() => tool.execute(tc.input), { maxRetries: 3, baseDelay: 1000, maxDelay: 5000, signal: options?.signal });
                                // Success! Reset failure counter.
                                toolFailureCounters.set(tc.name, 0);
                                results.push({
                                    type: 'tool_result',
                                    tool_use_id: tc.id,
                                    content: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
                                    is_error: result.isError
                                });
                                yield { type: 'tool_result', name: tc.name, id: tc.id, result: result.data };
                            }
                            catch (err) {
                                // Tracking tool failures
                                let fails = (toolFailureCounters.get(tc.name) || 0) + 1;
                                toolFailureCounters.set(tc.name, fails);
                                let errorMsg = err.message;
                                // Circuit Breaker triggering
                                if (fails >= 3) {
                                    logError(`[CircuitBreaker] Tool ${tc.name} failed 3 times. Injecting hard halt.`);
                                    errorMsg += `\n[SYSTEM_INSTRUCTION]: CIRCUIT_BREAKER_TRIGGERED. This tool has failed ${fails} consecutive times. DO NOT CALL ${tc.name} AGAIN IN THIS TURN. Inform the user gracefully of the failure and seek alternative solutions or ask for clarification.`;
                                }
                                results.push({
                                    type: 'tool_result',
                                    tool_use_id: tc.id,
                                    content: errorMsg,
                                    is_error: true
                                });
                            }
                        }
                    }
                    await this.updateHistory(conversationId, history, { role: 'user', content: results });
                }
                else {
                    if (assistantResponseContent) {
                        await this.updateHistory(conversationId, history, {
                            role: 'assistant',
                            content: assistantResponseContent,
                            metadata: { usage: { ...this.sessionUsage } }
                        });
                    }
                    continueLoop = false;
                }
            }
            if (turnCount >= this.maxTurns) {
                yield { type: 'stop', reason: 'max_turns' };
            }
            yield { type: 'usage', usage: this.sessionUsage };
        }
        finally {
            this.activeLocks.delete(conversationId);
        }
    }
}
//# sourceMappingURL=kernel.js.map