import { PersistenceAdapter } from '../../core/persistence.js';
import { Message } from '../../types/message.js';
export interface PostgresConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
}
/**
 * PostgresPersistence - Implementação de Nível Industrial (Event Store com Branching/Swarm).
 * Inspirado nos padrões de persistência imutável do OpenClaude.
 */
export declare class PostgresPersistence implements PersistenceAdapter {
    private pool;
    constructor(config: PostgresConfig);
    init(): Promise<void>;
    loadMessages(conversationId: string): Promise<Message[]>;
    /**
     * Salva as mensagens de forma inteligente.
     * Identifica novas mensagens e as anexa mantendo a integridade da árvore (parenting).
     */
    saveMessages(conversationId: string, messages: Message[]): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=postgres.d.ts.map