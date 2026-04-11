/**
 * ContextFolder - Especialista em compactação semântica de histórico.
 * Inspirado no 'analyzeContext.ts' e 'stopHooks.ts' do OpenClaude.
 * Garante que o Agente mantenha a 'essência' da conversa economizando 80% de tokens.
 */
export class ContextFolder {
    config;
    constructor(config = {}) {
        this.config = {
            minCharsToFold: config.minCharsToFold || 1500, // Dobra blocos > 1500 chars
            preserveLastN: config.preserveLastN || 5, // Nunca dobra as últimas 5 mensagens
        };
    }
    /**
     * Processa o histórico e aplica 'folding' em mensagens antigas e pesadas.
     */
    fold(history) {
        if (history.length <= this.config.preserveLastN)
            return history;
        return history.map((msg, index) => {
            // Regra 1: Não dobrar as últimas mensagens (contexto imediato)
            if (index >= history.length - this.config.preserveLastN)
                return msg;
            // Regra 2: Dobrar apenas mensagens do usuário (tool results) ou assistente com tool calls pesadas
            if (Array.isArray(msg.content)) {
                const foldedContent = msg.content.map(block => this.foldBlock(block));
                const isFolded = foldedContent.some(b => b.collapsed);
                return {
                    ...msg,
                    content: foldedContent,
                    metadata: {
                        ...msg.metadata,
                        folded: isFolded || msg.metadata?.folded
                    }
                };
            }
            return msg;
        });
    }
    foldBlock(block) {
        if (block.type === 'tool_result' && !block.collapsed) {
            if (block.content.length > this.config.minCharsToFold) {
                // Lógica de Folding: Resumimos o conteúdo mantendo apenas os primeiros/últimos 200 chars
                const head = block.content.substring(0, 300);
                const tail = block.content.substring(block.content.length - 300);
                const summary = `${head}\n\n[... FOLDED ${block.content.length - 600} CHARACTERS FOR TOKEN EFFICIENCY ...]\n\n${tail}`;
                return {
                    ...block,
                    collapsed: true,
                    original_length: block.content.length,
                    content: summary
                };
            }
        }
        return block;
    }
}
//# sourceMappingURL=folding.js.map