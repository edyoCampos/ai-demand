import { zodToJsonSchema as z2j } from 'zod-to-json-schema';
export function zodToJsonSchema(schema) {
    return z2j(schema, { target: 'openApi3' });
}
//# sourceMappingURL=zodToSchema.js.map