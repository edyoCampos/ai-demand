import { z } from 'zod';
/**
 * Cria a ferramenta de delegação para o Agente Mestre.
 */
export function createDelegateTool(spawner, parentSessionId) {
    return {
        name: 'delegate_task',
        description: 'Delega uma sub-tarefa complexa para um agente especialista em background.',
        inputSchema: z.object({
            agent_type: z.string().describe('Tipo do especialista (ex: coder, researcher, infrastructure)'),
            task: z.string().describe('A tarefa específica a ser realizada'),
            context: z.string().describe('Contexto necessário para o sub-agente'),
        }),
        execute: async (input) => {
            const subSessionId = `${parentSessionId}-sub-${Date.now()}`;
            const subAgent = spawner.spawn({
                agentType: input.agent_type,
                task: input.task,
                parentSessionId,
                subSessionId,
                specializedPrompt: `Task Context: ${input.context}\nYour specific objective: ${input.task}`
            });
            let finalResult = '';
            // Inicia a inferência do sub-agente (loop interno)
            // Ele salva seu próprio histórico no Postgres via subSessionId
            for await (const event of subAgent.ask(subSessionId, input.task)) {
                if (event.type === 'text_delta') {
                    finalResult += event.text;
                }
                else if (event.type === 'error') {
                    throw new Error(`Sub-agent failure: ${event.error}`);
                }
            }
            return {
                data: {
                    transcript: finalResult,
                    sub_session_id: subSessionId
                }
            };
        }
    };
}
//# sourceMappingURL=delegateTool.js.map