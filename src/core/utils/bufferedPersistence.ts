import { Message } from '../../types/message.js';
import { SessionMetadata, PersistenceAdapter } from '../persistence.js';

/**
 * BufferedPersistence - Impede escrita direta em produção (Audit V2 - Item 5.1).
 * Todas as gravações são mantidas em um buffer local e exigem 'commit' explícito
 * por uma entidade de autoridade (Master Agent).
 */
export class BufferedPersistence implements PersistenceAdapter {
  private buffer: Message[] = [];
  private metadata?: SessionMetadata;

  constructor(private basePersistence: PersistenceAdapter) {}

  async init(): Promise<void> {
    await this.basePersistence.init();
  }

  async loadMessages(sessionId: string): Promise<{ messages: Message[], metadata?: SessionMetadata }> {
    // Carrega do base e mescla com o buffer se necessário (Geralmente sub-agentes começam do zero ou base)
    const result = await this.basePersistence.loadMessages(sessionId);
    this.metadata = result.metadata;
    return { 
      messages: [...result.messages, ...this.buffer], 
      metadata: this.metadata 
    };
  }

  async saveMessages(sessionId: string, messages: Message[]): Promise<void> {
    // Audit V2 Protection: Não escreve na base original. Apenas no buffer.
    this.buffer = messages;
  }

  async saveAuditLog(sessionId: string, log: any): Promise<void> {
    // Logs de auditoria são gravados direto para transparência em tempo real
    await this.basePersistence.saveAuditLog(sessionId, log);
  }

  async getCumulativeTokens(sessionId: string): Promise<number> {
    return await this.basePersistence.getCumulativeTokens(sessionId);
  }

  /**
   * Retorna as mensagens pendentes no buffer.
   */
  getBuffer(): Message[] {
    return this.buffer;
  }

  /**
   * Efetiva as mensagens do buffer na persistência original.
   */
  async commit(sessionId: string): Promise<void> {
    if (this.buffer.length > 0) {
      await this.basePersistence.saveMessages(sessionId, this.buffer);
    }
  }

  // Metadata Methods (Proxy)
  async saveMetadata(key: string, value: any): Promise<void> {
    await this.basePersistence.saveMetadata(key, value);
  }

  async loadMetadata(key: string): Promise<any> {
    return await this.basePersistence.loadMetadata(key);
  }

  // Wiki Methods (Proxy para a persistência base)
  async saveWikiEntry(entry: any): Promise<string> {
    return await this.basePersistence.saveWikiEntry(entry);
  }

  async searchWiki(embedding: number[], limit?: number): Promise<any[]> {
    return await this.basePersistence.searchWiki(embedding, limit);
  }
}
