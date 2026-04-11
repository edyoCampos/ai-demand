import { Message } from '../../types/message.js';
export interface FoldingConfig {
    minCharsToFold: number;
    preserveLastN: number;
}
/**
 * ContextFolder - Especialista em compactação semântica de histórico.
 * Inspirado no 'analyzeContext.ts' e 'stopHooks.ts' do OpenClaude.
 * Garante que o Agente mantenha a 'essência' da conversa economizando 80% de tokens.
 */
export declare class ContextFolder {
    private config;
    constructor(config?: Partial<FoldingConfig>);
    /**
     * Processa o histórico e aplica 'folding' em mensagens antigas e pesadas.
     */
    fold(history: Message[]): Message[];
    private foldBlock;
}
//# sourceMappingURL=folding.d.ts.map