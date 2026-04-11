import crypto from "crypto";
import { ProviderAdapter } from "../providers/types.js";
import { CapabilityRegistry } from "./registry.js";
import { PersistenceAdapter, MemoryPersistence } from "./persistence.js";
import { Message, AgentEvent, AgentUsage } from "../types/message.js";
import { HookManager } from "./hooks.js";
import {
	normalizeArguments,
	normalizeMessagesForAPI,
} from "./utils/normalization.js";
import { withRetry } from "./utils/resilience.js";
import { logError } from "./utils/log.js";
import { ContextEngine } from "./contextEngine.js";
import { Sanitizer } from "./utils/sanitizer.js";
import { addCacheBreakpoints } from "./utils/caching.js";
import { kernelEvents } from "./events.js";

import { WikiEngine } from "./wiki/WikiEngine.js";

export interface AgentConfig {
	provider: ProviderAdapter;
	registry?: CapabilityRegistry;
	persistence?: PersistenceAdapter;
	hooks?: HookManager;
	wiki?: WikiEngine; // Novo: LTM L2 Engine
	systemPrompt?: string;
	maxTurns?: number;
	maxTokensPerTurn?: number;
	maxHistoryMessages?: number;
	temperature?: number;
	agentType?: string; // Metadata for agent identification
	orchestrationDepth?: number; // Current recursion depth (0 = master)
}

/**
 * DemandAI - The core autonomous agent kernel.
 * Optimized for resilience and event-sourced persistence.
 */
export class DemandAI {
	private provider: ProviderAdapter;
	public registry: CapabilityRegistry;
	private persistence: PersistenceAdapter;
	private hooks: HookManager;
	private wiki?: WikiEngine;
	private systemPrompt: string;
	private maxTurns: number;
	private maxTokensPerTurn: number;
	private temperature?: number;
	private context: ContextEngine;
	private agentType: string;
	public orchestrationDepth: number;
	public conversationId?: string; // Cache for current ID

	// Prevents multiple concurrent executions for the same conversationId
	private activeLocks = new Set<string>();

	private sessionUsage: AgentUsage = {
		prompt_tokens: 0,
		completion_tokens: 0,
		total_tokens: 0,
	};

	constructor(config: AgentConfig) {
		this.provider = config.provider;
		this.registry = config.registry || new CapabilityRegistry();
		this.persistence = config.persistence || new MemoryPersistence();
		this.hooks = config.hooks || new HookManager();
		this.wiki = config.wiki;
		this.systemPrompt = config.systemPrompt || "You are a helpful assistant.";
		this.maxTurns = config.maxTurns || 10;
		this.maxTokensPerTurn = config.maxTokensPerTurn || 100000;
		this.temperature = config.temperature;
		this.context = new ContextEngine(this.maxTokensPerTurn);
		this.agentType = config.agentType || "master";
		this.orchestrationDepth = config.orchestrationDepth || 0;
	}

	private async updateHistory(
		conversationId: string,
		history: Message[],
		newMessage: Message,
	): Promise<void> {
		history.push(newMessage);
		await this.persistence.saveMessages(conversationId, history);
	}

	async *ask(
		conversationId: string,
		userMessage: string,
		options?: { signal?: AbortSignal; subSessionId?: string; context?: string },
	): AsyncGenerator<AgentEvent> {
		if (this.activeLocks.has(conversationId)) {
			yield {
				type: "error",
				error:
					"Concurrency error: Another process is already running for this conversation.",
			};
			return;
		}

		// Circuit Breaker State (Per Conversation Turn)
		const toolFailureCounters = new Map<string, number>();

		try {
			this.activeLocks.add(conversationId);
			const loadResult = await this.persistence.loadMessages(conversationId);
			let history = loadResult.messages;
			const sessionMetadata = loadResult.metadata;

			if (userMessage) {
				// PHASE 0: Knowledge Injection (LTM L2 - Wiki)
				if (this.wiki) {
					try {
						const wikiResults = await this.wiki.search(userMessage, 2);
						if (wikiResults.length > 0) {
							const wikiSnippet = wikiResults.map(r => `## ${r.title}\n${r.content}`).join('\n\n');
							const wikiMessage: Message = {
								role: "system",
								content: `[LTM_WIKI_CONTEXT]: Fatos técnicos recuperados da persistência vetorial:\n${wikiSnippet}`,
								metadata: { is_boundary: true, type: 'wiki_injection' }
							};
							history.unshift(wikiMessage);
						}
					} catch (e) {
						console.error("[Kernel] Wiki Search Error:", e);
					}
				}

				if (options?.context) {
					const contextBriefing: Message = {
						role: "system",
						content: `[CONTEXTUAL_BRIEFING]: O Agente Master ou o Agente Pai forneceu os seguintes fatos/contexto para esta tarefa:\n${options.context}\nUtilize estas informações para guiar suas ações e evitar parâmetros 'undefined' em ferramentas.`,
						metadata: { is_boundary: true },
					};
					// Injeta no início se a história estiver vazia, ou logo após o sistema inicial
					history.unshift(contextBriefing);
				}

				// Enforce swarm_depth metadata on new messages
				const newMessage: Message = {
					role: "user",
					content: userMessage,
					metadata: {
						orchestration_depth: (sessionMetadata?.orchestration_depth || 0) + 1,
						is_boundary: false,
					},
				};
				await this.updateHistory(conversationId, history, newMessage);
			}

			let turnCount = 0;
			let continueLoop = true;
			let fullAssistantResponse = "";

			while (continueLoop && turnCount < this.maxTurns) {
				if (options?.signal?.aborted) {
					break; // Stop iteration immediately, save partial history done in finally
				}

				if (this.sessionUsage.total_tokens > this.maxTokensPerTurn) {
					yield { type: "error", error: "Token budget exceeded mid-stream." };
					break;
				}

				// PHASE 1: Context Folding & Token Budgeting (DemandAI Standard)
				let currentHistory = this.context.prepare(history, this.sessionUsage);

				currentHistory = normalizeMessagesForAPI(currentHistory);
				currentHistory = addCacheBreakpoints(currentHistory);

				turnCount++;
				let hasToolCalls = false;
				const toolCalls: any[] = [];
				let assistantResponseContent = "";

				try {
					// BRAKE DE RECURSÃO: Sub-agentes (depth > 0) não podem delegar mais tarefas.
					// Isso força a resolução local e impede explosões de tokens.
					let availableTools = this.registry.getAllTools();
					if (this.orchestrationDepth > 0) {
						availableTools = availableTools.filter(t => t.name !== 'delegate_task');
					}

					const stream = this.provider.call({
						messages: currentHistory,
						tools: availableTools,
						systemPrompt: this.buildSystemPrompt(options?.context),
						signal: options?.signal,
						temperature: this.temperature,
					});

					for await (const event of stream) {
						if (options?.signal?.aborted) {
							break;
						}
						if (event.type === "text_delta") {
							const sanitizedText = Sanitizer.sanitizeSecrets(event.text);
							assistantResponseContent += sanitizedText;
							fullAssistantResponse += sanitizedText;
							yield { type: "text_delta", text: sanitizedText };
						} else {
							yield event;
						}

						// Orchestration Auditing: Non-blocking Trace Tracking
						if (this.agentType !== "master") {
							if (event.type === "tool_call") {
								this.persistence
									.saveAuditLog(conversationId, {
										agentType: this.agentType,
										stepType: "tool_call",
										content: event.name,
										metadata: { input: event.input },
									})
									.catch(() => {});
							} else if (event.type === "tool_result") {
								this.persistence
									.saveAuditLog(conversationId, {
										agentType: this.agentType,
										stepType: "tool_result",
										content: event.name,
										metadata: { ts: Date.now() },
									})
									.catch(() => {});
							}
						}

						if (event.type === "tool_call") {
							hasToolCalls = true;
							const tool = this.registry.getTool(event.name);
							const normalizedInput = normalizeArguments(
								event.input,
								tool?.inputSchema,
							);
							toolCalls.push({ ...event, input: normalizedInput });
						} else if (event.type === "usage") {
							this.sessionUsage.prompt_tokens += event.usage.prompt_tokens || 0;
							this.sessionUsage.completion_tokens +=
								event.usage.completion_tokens || 0;
							this.sessionUsage.total_tokens += event.usage.total_tokens || 0;
						} else if (event.type === "stop") {
							if (event.reason === "end_turn" && !hasToolCalls) {
								continueLoop = false;
							}
						}
					}

					// PHASE 3: Post-Stream Audit (Final thought snapshot)
					if (this.agentType !== "master" && assistantResponseContent) {
						this.persistence
							.saveAuditLog(conversationId, {
								agentType: this.agentType,
								stepType: "thought",
								content: assistantResponseContent,
								metadata: { ts: Date.now(), final: true },
							})
							.catch(() => {});
					}
				} catch (error: any) {
					yield { type: "error", error: `Provider Error: ${error.message}` };
					break;
				}

				if (hasToolCalls) {
					await this.updateHistory(conversationId, history, {
						role: "assistant",
						content: [
							...(assistantResponseContent
								? [{ type: "text", text: assistantResponseContent }]
								: []),
							...toolCalls.map((tc) => ({
								type: "tool_use",
								id: tc.id,
								name: tc.name,
								input: tc.input,
							})),
						] as any,
					});

					const results: any[] = [];
					for (const tc of toolCalls) {
						const tool = this.registry.getTool(tc.name);
						if (tool) {
							const hookResult = await this.hooks.executeBeforeHooks(
								tool,
								tc.input,
							);
							if (hookResult.behavior === "deny") {
								results.push({
									type: "tool_result",
									tool_use_id: tc.id,
									content: `Error: Denied. ${hookResult.reason || ""}`,
									is_error: true,
								});
								continue;
							}

							try {
								// Injetar metadados agênticos para ferramentas que suportam (ex: delegate_task)
								const toolArgs = { 
									...tc.input, 
									_metadata: { 
										orchestrationDepth: this.orchestrationDepth,
										conversationId: conversationId
									} 
								};

								const TOOL_TIMEOUT = 30000;
								const result = await Promise.race([
									withRetry(() => tool.execute(toolArgs), {
										maxRetries: 3,
										baseDelay: 1000,
										maxDelay: 5000,
										signal: options?.signal,
									}),
									new Promise((_, reject) => 
										setTimeout(() => reject(new Error('Tool execution timeout (30s)')), TOOL_TIMEOUT)
									)
								]) as { data: any; isError?: boolean };

								// Success! Reset failure counter.
								toolFailureCounters.set(tc.name, 0);

								results.push({
									type: "tool_result",
									tool_use_id: tc.id,
									content:
										typeof result.data === "string"
											? result.data
											: JSON.stringify(result.data),
									is_error: result.isError,
								});
								yield {
									type: "tool_result",
									name: tc.name,
									id: tc.id,
									result: result.data,
								};
							} catch (err: any) {
								// Tracking tool failures
								let fails = (toolFailureCounters.get(tc.name) || 0) + 1;
								toolFailureCounters.set(tc.name, fails);

								let errorMsg = err.message;

								// Circuit Breaker triggering
								if (fails >= 3) {
									logError(
										`[CircuitBreaker] Tool ${tc.name} failed 3 times. Injecting hard halt.`,
									);
									errorMsg += `\n[SYSTEM_INSTRUCTION]: CIRCUIT_BREAKER_TRIGGERED. This tool has failed ${fails} consecutive times. DO NOT CALL ${tc.name} AGAIN IN THIS TURN. Inform the user of the failure and seek alternative solutions.`;
								}

								results.push({
									type: "tool_result",
									tool_use_id: tc.id,
									content: errorMsg,
									is_error: true,
								});
							}
						}
					}

					await this.updateHistory(conversationId, history, {
						role: "user",
						content: results as any,
					});
				} else {
					if (assistantResponseContent) {
						await this.updateHistory(conversationId, history, {
							role: "assistant",
							content: assistantResponseContent,
							metadata: { usage: { ...this.sessionUsage } },
						});
					}
					continueLoop = false;
				}
			}

			if (turnCount >= this.maxTurns) {
				yield { type: "stop", reason: "max_turns" };
			}

			const cumulativeTokens =
				await this.persistence.getCumulativeTokens(conversationId);
			yield {
				type: "usage",
				usage: {
					...this.sessionUsage,
					total_cumulative_tokens:
						cumulativeTokens || this.sessionUsage.total_tokens,
				},
			};

			// Emit Event for Async Synthesis (Wiki Engine)
			kernelEvents.emit('SESSION_COMPLETED', { 
				sessionId: conversationId, 
				history, 
				orchestrationDepth: this.orchestrationDepth 
			});
		} finally {
			this.activeLocks.delete(conversationId);
		}
	}

	/**
	 * Constrói o System Prompt dinâmico injetando contexto interno do DemandAI.
	 * Isso ajuda modelos menores (Ollama) a entenderem a arquitetura do sistema.
	 */
	private buildSystemPrompt(userContext: string = ""): string {
		const internalContext = `
[DEMANDAI_INTERNAL_CONTEXT]
- Identity: You are the DemandAI Core Engine.
- Architecture: Autonomous Resource Orchestrator.
- Capabilities: Adaptive Routing (Cloud/Local), WikiEngine (LTM L2), MCP Integration.
- Infrastructure: Hybrid Cluster (Groq, Gemini, Ollama).
- Mode: Resilience enabled.

[ORCHESTRATION_RULES - IRONCLAD]
1. É MANDATÓRIO responder diretamente a qualquer pergunta informativa ou teórica.
2. É PROIBIDO o uso de 'delegate_task' para melhorar a qualidade ou estilo da resposta.
3. USE 'delegate_task' APENAS se precisar de ferramentas que você tecnicamente não possui (ex: MCP específico que não está no seu registro atual).
4. O custo computacional e latência são PRIORIDADE. Respostas rápidas e diretas vencem orquestrações complexas.
5. Pense: 'Eu consigo responder isso agora sem ferramentas?'. Se SIM -> Responda de imediato.

[USER_CONTEXT]
${userContext || "Nenhum contexto adicional fornecido."}
`;
		return `${this.systemPrompt}\n\n${internalContext}`;
	}
}
