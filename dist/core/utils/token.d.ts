import { Message } from '../../types/message.js';
/**
 * TokenEstimator - Versão ultra-leve e sem dependências.
 * Baseado na média estatística de 1 token para cada 4 caracteres em Inglês/Código,
 * e 1 token para cada 2.5 caracteres em Latim/PT-BR.
 * Seguindo a abordagem pragmática do OpenClaude.
 */
export declare function estimateTokens(content: string | any[]): number;
export declare function estimateMessageTokens(messages: Message[]): number;
//# sourceMappingURL=token.d.ts.map