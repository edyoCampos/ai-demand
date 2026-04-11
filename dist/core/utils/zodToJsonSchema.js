import { z } from 'zod';
/**
 * A very simple Zod to JSON Schema converter for tool schemas.
 * For a full implementation, the 'zod-to-json-schema' package should be used.
 */
export function zodToJsonSchema(schema) {
    if (!schema)
        return {};
    // If it's already a JSON schema (has 'type' or 'properties')
    if (schema.type || schema.properties)
        return schema;
    // Basic conversion for Zod objects
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const properties = {};
        const required = [];
        for (const key in shape) {
            const field = shape[key];
            properties[key] = { type: 'string' }; // Fallback simple
            if (field instanceof z.ZodString)
                properties[key].type = 'string';
            if (field instanceof z.ZodNumber)
                properties[key].type = 'number';
            if (field instanceof z.ZodBoolean)
                properties[key].type = 'boolean';
            if (field instanceof z.ZodArray)
                properties[key].type = 'array';
            if (!field.isOptional()) {
                required.push(key);
            }
        }
        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
        };
    }
    return {};
}
//# sourceMappingURL=zodToJsonSchema.js.map