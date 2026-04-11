import { Message } from '../../types/message.js';
/**
 * NormalizationEngine - Inspirado no OpenClaude.
 */
/**
 * Converte argumentos brutos do LLM para um objeto JSON válido,
 * corrigindo alucinações de nomes de campos e problemas de formatação.
 */
export declare function normalizeToolArguments(toolName: string, rawArguments: string | undefined, inputSchema?: any): Record<string, any>;
/**
 * Função de conveniência usada pelo Kernel para normalizar argumentos de chamadas de ferramentas.
 */
export declare function normalizeArguments(args: string | any, schema?: any): any;
/**
 * Normaliza mensagens para a API:
 * 1. Remove metadados internos.
 * 2. COALESCING: Mescla mensagens consecutivas do mesmo papel (exigido por Ollama/Mistral).
 */
export declare function normalizeMessagesForAPI(messages: Message[]): Message[];
//# sourceMappingURL=normalization.d.ts.map