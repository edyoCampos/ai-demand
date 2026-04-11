import { Message } from '../types/message.js';
export { Message };

export interface SessionMetadata {
  sessionId: string;
  parentSessionId?: string;
  orchestrationDepth: number;
  totalTokens: number;
  [key: string]: any;
}

export interface PersistenceAdapter {
  init(): Promise<void>;
  loadMessages(sessionId: string): Promise<{ messages: Message[], metadata?: SessionMetadata }>;
  saveMessages(sessionId: string, messages: Message[]): Promise<void>;
  saveAuditLog(sessionId: string, log: { agentType: string, stepType: string, content: string, metadata?: any }): Promise<void>;
  getCumulativeTokens(sessionId: string): Promise<number>;
  
  // Global State (Health tracking, settings, etc.)
  saveMetadata(key: string, value: any): Promise<void>;
  loadMetadata(key: string): Promise<any>;
  
  close?(): Promise<void>;
}

export class MemoryPersistence implements PersistenceAdapter {
  private store = new Map<string, Message[]>();
  private tokens = new Map<string, number>();

  async init(): Promise<void> {}

  async loadMessages(sessionId: string): Promise<{ messages: Message[], metadata?: SessionMetadata }> {
    const messages = this.store.get(sessionId) || [];
    const totalTokens = this.tokens.get(sessionId) || 0;
    return { 
      messages,
      metadata: { sessionId, orchestrationDepth: 0, totalTokens }
    };
  }

  async saveMessages(sessionId: string, messages: Message[]): Promise<void> {
    this.store.set(sessionId, messages);
    const totalTokens = messages.reduce((acc, msg) => acc + ((msg.metadata as any)?.usage?.total_tokens || 0), 0);
    this.tokens.set(sessionId, totalTokens);
  }

  async getCumulativeTokens(sessionId: string): Promise<number> {
    return this.tokens.get(sessionId) || 0;
  }

  async saveAuditLog(sessionId: string, log: any): Promise<void> {
    // Memory implementation - logs are volatile
  }

  async saveMetadata(key: string, value: any): Promise<void> {
    this.store.set(`meta:${key}`, [value] as any);
  }

  async loadMetadata(key: string): Promise<any> {
    const res = this.store.get(`meta:${key}`);
    return res ? res[0] : null;
  }

  async saveWikiEntry(_entry: any): Promise<string> {
    return 'memory-id';
  }

  async searchWiki(_embedding: number[], _limit?: number): Promise<any[]> {
    return [];
  }
}
