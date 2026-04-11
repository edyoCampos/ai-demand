import { z } from 'zod';
import { zodToJsonSchema as z2j } from 'zod-to-json-schema';

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  try {
    // Sanity check: Se não for um objeto Zod válido (conflito de instâncias), 
    // z2j falha com TypeError ao ler _def.typeName.
    if (!schema || typeof schema !== 'object' || !('_def' in (schema as any))) {
      return { type: 'object', properties: {}, additionalProperties: true };
    }

    return z2j(schema, { target: 'openApi3' }) as Record<string, unknown>;
  } catch (err) {
    // Fallback silencioso: Em produção já garantimos que o sistema não crasha.
    // Console log apenas em ambiente de desenvolvimento se necessário.
    return {
      type: 'object',
      properties: {},
      additionalProperties: true
    };
  }
}
