/**
 * NormalizationEngine - Inspirado no OpenClaude.
 */
/**
 * Converte argumentos brutos do LLM para um objeto JSON válido,
 * corrigindo alucinações de nomes de campos e problemas de formatação.
 */
export function normalizeToolArguments(toolName, rawArguments, inputSchema) {
    if (!rawArguments)
        return {};
    try {
        const parsed = typeof rawArguments === 'string' ? JSON.parse(rawArguments) : rawArguments;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            if (inputSchema && inputSchema.shape) {
                const expectedFields = Object.keys(inputSchema.shape);
                const actualFields = Object.keys(parsed);
                for (const actual of actualFields) {
                    if (!expectedFields.includes(actual)) {
                        const target = expectedFields.find(f => f.startsWith(actual) ||
                            actual.startsWith(f) ||
                            f.toLowerCase().includes(actual.toLowerCase()));
                        if (target) {
                            parsed[target] = parsed[actual];
                        }
                    }
                }
            }
            return parsed;
        }
        if (inputSchema && inputSchema.shape) {
            const fields = Object.keys(inputSchema.shape);
            if (fields.length === 1)
                return { [fields[0]]: parsed };
        }
        return typeof parsed === 'object' ? parsed : {};
    }
    catch (e) {
        if (inputSchema && inputSchema.shape) {
            const fields = Object.keys(inputSchema.shape);
            if (fields.length === 1) {
                const cleanRaw = rawArguments.replace(/^["']|["']$/g, '').trim();
                return { [fields[0]]: cleanRaw };
            }
        }
        return {};
    }
}
/**
 * Função de conveniência usada pelo Kernel para normalizar argumentos de chamadas de ferramentas.
 */
export function normalizeArguments(args, schema) {
    return normalizeToolArguments('', typeof args === 'string' ? args : JSON.stringify(args), schema);
}
/**
 * Normaliza mensagens para a API:
 * 1. Remove metadados internos.
 * 2. COALESCING: Mescla mensagens consecutivas do mesmo papel (exigido por Ollama/Mistral).
 */
export function normalizeMessagesForAPI(messages) {
    if (messages.length === 0)
        return [];
    const coalesced = [];
    for (const msg of messages) {
        const prev = coalesced[coalesced.length - 1];
        // Se o papel for o mesmo (e não for 'tool', que permite múltiplos), mesclamos.
        if (prev && prev.role === msg.role && msg.role !== 'system') {
            const prevContent = typeof prev.content === 'string' ? prev.content : JSON.stringify(prev.content);
            const curContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            prev.content = `${prevContent}\n\n${curContent}`;
        }
        else {
            // Clone para evitar mutação do histórico original
            coalesced.push({ ...msg });
        }
    }
    return coalesced;
}
//# sourceMappingURL=normalization.js.map