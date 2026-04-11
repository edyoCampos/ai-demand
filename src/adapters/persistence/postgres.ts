import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';
import { PersistenceAdapter, Message, SessionMetadata } from '../../core/persistence.js';
import { logError } from '../../core/utils/log.js';

/**
 * PostgresPersistence (Arquitetura Industrial Blindada).
 * Foco: Resiliência contra dados corrompidos e erros de driver.
 */
export class PostgresPersistence implements PersistenceAdapter {
  private pool: pg.Pool;

  constructor(config: pg.PoolConfig) {
    this.pool = new Pool(config);
  }

  private safeParse(data: any): any {
    if (!data) return {};
    if (typeof data === 'object' && data !== null) return data;
    try {
      // Se for a string "[object Object]", recupera como vazio
      if (data === '[object Object]') return {};
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // DROP de tabelas corrompidas para garantir clean state (Audit V2 - Reset Agressivo)
      // Usaremos apenas no laboratório se necessário, mas aqui faremos o setup robusto
      
      // Habilita a extensão pgvector para busca semântica
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          metadata TEXT DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          swarm_depth INTEGER DEFAULT 0
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS swarm_logs (
          id SERIAL PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          agent_type TEXT NOT NULL,
          step_type TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY,
          conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          is_boundary BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS wiki_entries (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          embedding vector(768),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Criar índice HNSW para busca vetorial veloz (Cosseno)
      await client.query(`
        CREATE INDEX IF NOT EXISTS wiki_entries_embedding_idx 
        ON wiki_entries USING hnsw (embedding vector_cosine_ops);
      `);

      // Migração e Limpeza para resolver lixo legado e schemas errados de versões anteriores
      await client.query(`
        DO $$ 
        BEGIN 
          -- Garante tipo TEXT para todas as colunas mistas
          ALTER TABLE messages ALTER COLUMN content TYPE TEXT;
          ALTER TABLE messages ALTER COLUMN metadata TYPE TEXT;
          ALTER TABLE conversations ALTER COLUMN metadata TYPE TEXT;
          ALTER TABLE swarm_logs ALTER COLUMN metadata TYPE TEXT;
        EXCEPTION WHEN OTHERS THEN
          -- Silencioso
        END $$;
      `);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async loadMessages(sessionId: string): Promise<{ messages: Message[], metadata?: SessionMetadata }> {
    const client = await this.pool.connect();
    try {
      const convRes = await client.query('SELECT metadata FROM conversations WHERE id = $1', [sessionId]);
      const msgRes = await client.query(`
        WITH recent_boundary AS (
          SELECT created_at FROM messages 
          WHERE conversation_id = $1 AND is_boundary = TRUE
          ORDER BY created_at DESC LIMIT 1
        )
        SELECT role, content, metadata, is_boundary 
        FROM messages 
        WHERE conversation_id = $1 
        AND (created_at >= (SELECT created_at FROM recent_boundary) OR NOT EXISTS (SELECT 1 FROM recent_boundary))
        ORDER BY created_at ASC
      `, [sessionId]);

      return {
        messages: msgRes.rows.map(r => {
           let parsedContent = r.content;
           try {
             if (typeof r.content === 'string' && (r.content.startsWith('[') || r.content.startsWith('{'))) {
               parsedContent = JSON.parse(r.content);
             }
           } catch(e) {}
           
           return {
             ...r,
             content: parsedContent,
             metadata: this.safeParse(r.metadata)
           };
        }),
        metadata: this.safeParse(convRes.rows[0]?.metadata)
      };
    } finally {
      client.release();
    }
  }

  async saveMessages(sessionId: string, messages: Message[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const swarmDepth = messages.find(m => m.metadata?.swarm_depth)?.metadata?.swarm_depth || 0;
      const metadataStr = JSON.stringify({ swarm_depth: swarmDepth });

      await client.query(`
        INSERT INTO conversations (id, metadata, updated_at, swarm_depth)
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
        ON CONFLICT (id) DO UPDATE SET 
          metadata = EXCLUDED.metadata, 
          updated_at = CURRENT_TIMESTAMP,
          swarm_depth = EXCLUDED.swarm_depth
      `, [sessionId, metadataStr, swarmDepth]);

      for (const msg of messages) {
        const msgMetadataStr = JSON.stringify(msg.metadata || {});
        // BINGO: Prevenindo '[object Object]'. Se for array de ContentBlock, stringifica!
        const msgContentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        await client.query(`
          INSERT INTO messages (id, conversation_id, role, content, metadata, is_boundary)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [
          msg.metadata?.id || crypto.randomUUID(),
          sessionId,
          msg.role,
          msgContentStr,
          msgMetadataStr,
          msg.metadata?.is_boundary || false
        ]);
      }
      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      logError(`PostgresPersistence.saveMessages FATAL: ${e.message}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async saveAuditLog(sessionId: string, log: any): Promise<void> {
    const logMetadataStr = JSON.stringify(log.metadata || {});
    this.pool.query(`
      INSERT INTO swarm_logs (conversation_id, agent_type, step_type, content, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [sessionId, log.agentType, log.stepType, log.content, logMetadataStr])
    .catch(err => logError(`AuditLog Persistence Error: ${err.message}`));
  }

  async getCumulativeTokens(sessionId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(`
        WITH RECURSIVE swarm_tree AS (
          SELECT id, metadata FROM conversations WHERE id = $1
          UNION ALL
          SELECT c.id, c.metadata FROM conversations c
          INNER JOIN swarm_tree st ON c.id LIKE 'sub_' || st.id || '%' OR c.metadata LIKE '%"parent_session_id":"' || st.id || '"%'
        )
        SELECT metadata FROM swarm_tree
      `, [sessionId]);

      let total = 0;
      for (const row of res.rows) {
        try {
          const meta = this.safeParse(row.metadata);
          total += parseInt(meta.usage?.total_tokens || 0);
        } catch {}
      }
      return total;
    } finally {
      client.release();
    }
  }

  async saveWikiEntry(entry: { id?: string, title: string, content: string, metadata?: any, embedding: number[] }): Promise<string> {
    const client = await this.pool.connect();
    try {
      const id = entry.id || crypto.randomUUID();
      const metadataStr = JSON.stringify(entry.metadata || {});
      const embeddingStr = `[${entry.embedding.join(',')}]`;

      await client.query(`
        INSERT INTO wiki_entries (id, title, content, metadata, embedding, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET 
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          updated_at = CURRENT_TIMESTAMP
      `, [id, entry.title, entry.content, metadataStr, embeddingStr]);

      return id;
    } finally {
      client.release();
    }
  }

  async searchWiki(embedding: number[], limit: number = 5): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const embeddingStr = `[${embedding.join(',')}]`;
      const res = await client.query(`
        SELECT id, title, content, metadata, 
               (embedding <=> $1) as distance
        FROM wiki_entries
        ORDER BY distance ASC
        LIMIT $2
      `, [embeddingStr, limit]);

      return res.rows.map(r => ({
        ...r,
        metadata: this.safeParse(r.metadata)
      }));
    } finally {
      client.release();
    }
  }

  async saveMetadata(key: string, value: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      const metadata = JSON.stringify({ [key]: value });
      await client.query(`
        INSERT INTO conversations (id, metadata, updated_at)
        VALUES ('SYSTEM_HEALTH', $1, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET 
          metadata = jsonb_set(
            COALESCE(conversations.metadata::jsonb, '{}'::jsonb), 
            array[$2], 
            $3::jsonb
          )::text,
          updated_at = CURRENT_TIMESTAMP
      `, [metadata, key, JSON.stringify(value)]);
    } catch (e) {
      // Se falhar (ex: coluna não é jsonb), faz o simples
      const current = await this.loadMetadata(key) || {};
      const next = JSON.stringify({ ...current, [key]: value });
      await this.pool.query(`
        INSERT INTO conversations (id, metadata, updated_at)
        VALUES ('SYSTEM_HEALTH', $1, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP
      `, [next]);
    } finally {
      client.release();
    }
  }

  async loadMetadata(key: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      const res = await client.query("SELECT metadata FROM conversations WHERE id = 'SYSTEM_HEALTH'");
      if (res.rows.length === 0) return null;
      const meta = this.safeParse(res.rows[0].metadata);
      return meta[key] || null;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
