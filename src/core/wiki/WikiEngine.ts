import { PersistenceAdapter } from '../persistence.js';
import { ProviderAdapter } from '../../providers/types.js';
import { Message } from '../../types/message.js';
import { kernelEvents } from '../events.js';
import fs from 'fs/promises';
import path from 'path';
import { Sanitizer } from '../utils/sanitizer.js';
import { WikiSanitizer } from './WikiSanitizer.js';

/**
 * WikiEngine - Módulo de Persistência de Conhecimento de Longo Prazo (LTM L2).
 * Responsável por sintetizar histórico de conversas em verbetes permanentes.
 */
export class WikiEngine {
  private persistence: PersistenceAdapter;
  private chatProvider: ProviderAdapter;
  private vectorProvider: ProviderAdapter;
  private wikiDir: string;

  constructor(persistence: PersistenceAdapter, chatProvider: ProviderAdapter, vectorProvider?: ProviderAdapter) {
    this.persistence = persistence;
    this.chatProvider = chatProvider;
    this.vectorProvider = vectorProvider || chatProvider;
    this.wikiDir = path.resolve(process.cwd(), 'docs/wiki');
    
    // Escuta eventos de finalização de sessão para processamento assíncrono
    kernelEvents.on('SESSION_COMPLETED', async ({ sessionId, history, orchestrationDepth }) => {
      // Gate de Performance: Sintetiza apenas se for o Agente Master (Profundidade 0)
      // Evita o spam de sínteses de sub-agentes pequenos.
      if (orchestrationDepth > 0) return;

      console.log(`[WikiEngine] Processando síntese: Sessão ${sessionId}...`);
      await this.synthesize(sessionId, history);
    });
  }

  /**
   * Transforma um histórico de mensagens em novos verbetes ou atualizações.
   */
  async synthesize(sessionId: string, history: Message[]): Promise<void> {
    const transcript = history.map(m => `[${m.role}]: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n');
    
    const prompt = `
      EXTRATOR DE CONHECIMENTO (DOMÍNIO DE NEGÓCIO)
      
      Instruções:
      1. Extraia fatos técnicos e decisões de negócio do histórico abaixo.
      2. PROIBIDO: Extrair dados sobre a arquitetura interna do DemandAI (Kernel, Wiki, etc).
      3. RETORNE APENAS JSON no formato: { "entries": [{ "title": "TITULO", "content": "Markdown", "tags": [] }] }
      
      Histórico:
      ${transcript}
    `;

    try {
      const responseStream = this.chatProvider.call({
        messages: [{ role: 'user', content: prompt }],
        tools: [],
        systemPrompt: "Você é um robô que extrai dados de negócio e responde APENAS JSON puro.",
        temperature: 0.1
      });

      let fullText = "";
      for await (const event of responseStream) {
        if (event.type === 'text_delta') fullText += event.text;
      }

      // Parser robusto para extrair o conteúdo JSON do markdown
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[WikiEngine] Nenhum JSON encontrado na resposta da síntese.");
        return;
      }

      // Limpeza de caracteres de controle que quebram o JSON.parse (comum em blocos de código markdown)
      const cleanJsonStr = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove caracteres de controle literais
        .replace(/\\n/g, "\\n") // Preserva quebras de linha escapadas
        .replace(/\n/g, "\\n")  // Escapa quebras de linha literais dentro de strings (comum em falhas de LLM)
        .replace(/\r/g, "");

      let data;
      try {
        // Tentativa 1: Parse direto após limpeza básica
        data = JSON.parse(cleanJsonStr);
      } catch (e) {
        // Tentativa 2: Fallback para o match original se a limpeza for agressiva demais
        try {
           data = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error("[WikiEngine] Erro fatal ao parsear JSON da síntese:", e2);
          return;
        }
      }

      if (!data.entries || !Array.isArray(data.entries)) {
        console.warn("[WikiEngine] Formato JSON inválido: 'entries' não encontrado.");
        return;
      }

      for (const entry of data.entries) {
        if (!entry.title || !entry.content) continue;
        
        // Aplica Sanitização de Segurança L2
        const safeContent = WikiSanitizer.sanitize(entry.content);
        const safeTitle = WikiSanitizer.sanitizeTitle(entry.title);

        if (!safeContent || !safeTitle) continue;

        await this.addEntry(safeTitle, safeContent, { 
          session_id: sessionId, 
          tags: entry.tags || [] 
        });
      }
    } catch (error) {
      console.error("[WikiEngine] Erro crítico na síntese:", error);
    }
  }

  /**
   * Adiciona ou atualiza um verbete na Wiki.
   */
  async addEntry(title: string, content: string, metadata: any = {}): Promise<void> {
    const embedding = await this.vectorProvider.embed(`${title}\n${content}`);
    
    const entryId = await this.persistence.saveWikiEntry({
      title,
      content,
      metadata,
      embedding
    });

    const safeFilename = Sanitizer.sanitizeFilename(title);
    const filePath = path.join(this.wikiDir, `${safeFilename}.md`);
    const mdContent = `---
title: ${title}
id: ${entryId}
updated_at: ${new Date().toISOString()}
---

${content}
`;
    
    await fs.mkdir(this.wikiDir, { recursive: true });
    await fs.writeFile(filePath, mdContent, 'utf8');

    kernelEvents.emit('WIKI_UPDATED', { entryId, title });
  }

  /**
   * Busca semântica vetorial na Wiki.
   */
  async search(query: string, limit: number = 3): Promise<any[]> {
    const embedding = await this.vectorProvider.embed(query);
    return this.persistence.searchWiki(embedding, limit);
  }
}
