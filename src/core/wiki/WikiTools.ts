import { z } from 'zod';
import { Tool, ToolResult } from '../tool.js';
import { WikiEngine } from './WikiEngine.js';

/**
 * Ferramenta para buscar conhecimento na Wiki.
 */
export class SearchWikiTool implements Tool {
  name = 'search_wiki';
  description = 'Pesquisa na Wiki de Conhecimento do DemandAI para recuperar fatos técnicos, decisões passadas e conceitos aprendidos.';
  
  inputSchema = z.object({
    query: z.string().describe('A pergunta ou termo de busca semântica.'),
    limit: z.number().optional().default(3).describe('Quantidade de verbetes a retornar.')
  });

  constructor(private wiki: WikiEngine) {}

  async execute(args: z.infer<typeof this.inputSchema>): Promise<ToolResult> {
    try {
      const results = await this.wiki.search(args.query, args.limit);
      if (results.length === 0) {
        return { data: "Nenhum resultado encontrado na Wiki para esta consulta." };
      }
      
      const formatted = results.map(r => `## ${r.title}\n${r.content}`).join('\n\n');
      return { data: formatted };
    } catch (error: any) {
      return { data: `Erro na busca na Wiki: ${error.message}`, isError: true };
    }
  }
}

/**
 * Ferramenta para atualizar ou adicionar um verbete na Wiki.
 */
export class UpdateWikiTool implements Tool {
  name = 'update_wiki';
  description = 'Adiciona ou atualiza um verbete na Wiki. Use apenas para informações técnicas permanentes e confirmadas.';
  
  inputSchema = z.object({
    title: z.string().describe('Título curto e claro do verbete (ex: "Configuração do Docker no Windows").'),
    content: z.string().describe('Conteúdo em Markdown detalhando o conhecimento.'),
    tags: z.array(z.string()).optional().describe('Tags para categorização.')
  });

  constructor(private wiki: WikiEngine) {}

  async execute(args: z.infer<typeof this.inputSchema>): Promise<ToolResult> {
    try {
      await this.wiki.addEntry(args.title, args.content, { tags: args.tags });
      return { data: `Verbete "${args.title}" atualizado com sucesso na Wiki.` };
    } catch (error: any) {
      return { data: `Erro ao atualizar Wiki: ${error.message}`, isError: true };
    }
  }
}
