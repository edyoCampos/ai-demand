import { z } from 'zod';
import { AgentOrchestrator } from './agentOrchestrator.js';

/**
 * Cria a ferramenta de delegação (Orchestration Tool).
 * Permite que um agente instancie sub-agentes para resolver sub-tarefas.
 */
export function createOrchestrationTool(orchestrator: AgentOrchestrator, sessionPrefix: string = 'sub') {
  return {
    name: "delegate_task",
    description: "Delega uma tarefa complexa para um sub-agente especialista com contexto isolado.",
    inputSchema: z.object({
      agent_type: z.string().describe("Tipo de especialista (ex: coder, analyst, searcher)"),
      task: z.string().describe("Descrição clara da sub-tarefa a ser realizada"),
      context: z.string().describe("Fatos essenciais e dados necessários para o sucesso da tarefa"),
      tools: z.array(z.string()).optional().describe("Lista opcional de ferramentas permitidas")
    }),
    execute: async (args: any) => {
      const parentSessionId = args._metadata?.conversationId || 'unknown';
      const parentDepth = args._metadata?.orchestrationDepth || 0;
      const subSessionId = `${sessionPrefix}_${parentSessionId.substring(0, 8)}_${Date.now()}`;

      const subAgent = await orchestrator.orchestrate({
        agentType: args.agent_type,
        task: args.task,
        context: args.context,
        parentSessionId,
        subSessionId,
        parentDepth,
        tools: args.tools
      });

      console.log(`\n[Orchestration] Delegando: ${args.agent_type} -> ${subSessionId}`);
      
      let fullResponse = "";
      for await (const event of subAgent.ask(subSessionId, args.task)) {
        if (event.type === 'text_delta') {
          fullResponse += event.text;
        }
      }

      return { data: fullResponse };
    }
  };
}
