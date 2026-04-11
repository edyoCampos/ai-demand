import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
const { Pool } = pg;
/**
 * PostgresPersistence - Implementação de Nível Industrial (Event Store com Branching/Swarm).
 * Inspirado nos padrões de persistência imutável do OpenClaude.
 */
export class PostgresPersistence {
    pool;
    constructor(config) {
        this.pool = new Pool(config);
    }
    async init() {
        const client = await this.pool.connect();
        try {
            await client.query(`
        -- Tabela de Conversas Evoluída (Suporte a Swarm)
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          parent_session_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
          metadata JSONB DEFAULT '{}',
          total_tokens INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Tabela de Mensagens Evoluída (Suporte a Branching/Imutabilidade)
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY,
          conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
          parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
          role TEXT NOT NULL,
          content JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          sequence_num SERIAL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_seq ON messages(conversation_id, sequence_num);
        CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);
      `);
        }
        finally {
            client.release();
        }
    }
    async loadMessages(conversationId) {
        const res = await this.pool.query('SELECT role, content, metadata FROM messages WHERE conversation_id = $1 ORDER BY sequence_num ASC', [conversationId]);
        return res.rows.map((row) => ({
            role: row.role,
            content: row.content,
            metadata: row.metadata
        }));
    }
    /**
     * Salva as mensagens de forma inteligente.
     * Identifica novas mensagens e as anexa mantendo a integridade da árvore (parenting).
     */
    async saveMessages(conversationId, messages) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Garantir existência da conversa mestre ou sub-sessão
            const isSubSession = messages[0]?.metadata?.parent_session_id;
            await client.query('INSERT INTO conversations (id, parent_session_id, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP', [conversationId, isSubSession || null]);
            const existing = await client.query('SELECT id, sequence_num FROM messages WHERE conversation_id = $1 ORDER BY sequence_num ASC', [conversationId]);
            const existingIds = existing.rows.map(r => r.id);
            let lastParentId = existing.rows.length > 0 ? existing.rows[existing.rows.length - 1].id : null;
            // Anexar apenas o diferencial (New Messages)
            const newMessages = messages.slice(existing.rows.length);
            for (const msg of newMessages) {
                const messageId = uuidv4();
                await client.query('INSERT INTO messages (id, conversation_id, parent_message_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5, $6)', [messageId, conversationId, lastParentId, msg.role, JSON.stringify(msg.content), JSON.stringify(msg.metadata || {})]);
                lastParentId = messageId;
            }
            // Sincronizar Tokens (Métrica Industrial)
            let totalTokens = 0;
            for (const msg of messages) {
                if (msg.metadata?.usage?.total_tokens) {
                    totalTokens += msg.metadata.usage.total_tokens;
                }
            }
            if (totalTokens > 0) {
                await client.query('UPDATE conversations SET total_tokens = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [totalTokens, conversationId]);
            }
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
//# sourceMappingURL=postgres.js.map