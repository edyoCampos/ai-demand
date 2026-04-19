import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import os from 'node:os';

/**
 * MCP Server de Teste (Mock) - Versão ESM (.mts)
 * Fornece métricas de sistema para validar a integração nativa do DemandAI.
 */
const server = new McpServer({
  name: "system-monitor",
  version: "1.0.0",
});

// Registrar ferramenta de saúde do sistema
server.tool(
  "get_system_health",
  "Retorna a saúde atual do sistema (CPU, Memória, Uptime)",
  {}, // Nenhum parâmetro necessário
  async () => {
    const totalMem = os.totalmem() / (1024 * 1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024 * 1024);
    
    return {
      content: [
        {
          type: "text",
          text: `Saída do MCP: Sistema operacional ${os.platform()}. Memória Livre: ${freeMem.toFixed(2)}GB de ${totalMem.toFixed(2)}GB. Tempo de atividade: ${(os.uptime() / 3600).toFixed(2)} horas.`,
        },
      ],
    };
  }
);

// Iniciar conexão Stdio
try {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP System Monitor Server iniciado via Stdio (.mts)");
} catch (error) {
  console.error("Erro ao iniciar servidor MCP:", error);
}
