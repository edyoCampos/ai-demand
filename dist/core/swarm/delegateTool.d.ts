import { z } from 'zod';
import { AgentSpawner } from './agentSpawner.js';
/**
 * Cria a ferramenta de delegação para o Agente Mestre.
 */
export declare function createDelegateTool(spawner: AgentSpawner, parentSessionId: string): {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        agent_type: z.ZodString;
        task: z.ZodString;
        context: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task: string;
        context: string;
        agent_type: string;
    }, {
        task: string;
        context: string;
        agent_type: string;
    }>;
    execute: (input: {
        agent_type: string;
        task: string;
        context: string;
    }) => Promise<{
        data: {
            transcript: string;
            sub_session_id: string;
        };
    }>;
};
//# sourceMappingURL=delegateTool.d.ts.map