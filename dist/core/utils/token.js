/**
 * TokenEstimator - Versão ultra-leve e sem dependências.
 * Baseado na média estatística de 1 token para cada 4 caracteres em Inglês/Código,
 * e 1 token para cada 2.5 caracteres em Latim/PT-BR.
 * Seguindo a abordagem pragmática do OpenClaude.
 */
export function estimateTokens(content) {
    if (Array.isArray(content)) {
        return content.reduce((acc, block) => acc + estimateTokens(JSON.stringify(block)), 0);
    }
    if (typeof content !== 'string')
        return 0;
    // Heurística: média de 3.25 caracteres por token para um mix de código e texto natural.
    return Math.ceil(content.length / 3.25);
}
export function estimateMessageTokens(messages) {
    return messages.reduce((acc, msg) => {
        return acc + estimateTokens(msg.content) + 5; // +5 para overhead de role/metadata
    }, 0);
}
//# sourceMappingURL=token.js.map