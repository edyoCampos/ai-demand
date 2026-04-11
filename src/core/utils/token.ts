import { Message } from '../../types/message.js';

/**
 * TokenEstimator - Versão ultra-leve e sem dependências.
 * Baseado na média estatística de 1 token para cada 4 caracteres em Inglês/Código,
 * e 1 token para cada 2.5 caracteres em Latim/PT-BR.
 * Utilitário de contagem de tokens (DemandAI Standard).
 */
export function estimateTokens(content: string | any[]): number {
  if (Array.isArray(content)) {
    return content.reduce((acc, block) => acc + estimateTokens(JSON.stringify(block)), 0);
  }
  
  if (typeof content !== 'string') return 0;

  // Heurística: média de 3.25 caracteres por token para um mix de código e texto natural.
  return Math.ceil(content.length / 3.25);
}

export function estimateMessageTokens(messages: Message[]): number {
  return messages.reduce((acc, msg) => {
    return acc + estimateTokens(msg.content) + 5; // +5 para overhead de role/metadata
  }, 0);
}
