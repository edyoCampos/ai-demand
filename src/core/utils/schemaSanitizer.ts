const OPENAI_INCOMPATIBLE_SCHEMA_KEYWORDS = new Set([
  '$comment',
  '$schema',
  'default',
  'else',
  'examples',
  'format',
  'if',
  'maxLength',
  'maximum',
  'minLength',
  'minimum',
  'multipleOf',
  'pattern',
  'patternProperties',
  'propertyNames',
  'then',
  'unevaluatedProperties',
]);

function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripSchemaKeywords(schema: unknown, keywords: Set<string>): unknown {
  if (Array.isArray(schema)) {
    return schema.map(item => stripSchemaKeywords(item, keywords));
  }

  if (!isSchemaRecord(schema)) {
    return schema;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && isSchemaRecord(value)) {
      const sanitizedProps: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(value)) {
        sanitizedProps[propName] = stripSchemaKeywords(propSchema, keywords);
      }
      result[key] = sanitizedProps;
      continue;
    }

    if (keywords.has(key)) {
      continue;
    }

    result[key] = stripSchemaKeywords(value, keywords);
  }

  return result;
}

function deepEqualJsonValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((value, index) => deepEqualJsonValue(value, b[index]))
    );
  }

  if (isSchemaRecord(a) && isSchemaRecord(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every(key => key in b && deepEqualJsonValue(a[key], b[key]))
    );
  }

  return false;
}

function matchesJsonSchemaType(type: string, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function schemaAllowsValue(schema: Record<string, unknown>, value: unknown): boolean {
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some(item =>
      schemaAllowsValue(sanitizeSchema(item as any), value),
    );
  }

  if (Array.isArray(schema.oneOf)) {
    return (
      schema.oneOf.filter(item =>
        schemaAllowsValue(sanitizeSchema(item as any), value),
      ).length === 1
    );
  }

  if (Array.isArray(schema.allOf)) {
    return schema.allOf.every(item =>
      schemaAllowsValue(sanitizeSchema(item as any), value),
    );
  }

  if ('const' in schema && !deepEqualJsonValue(schema.const, value)) {
    return false;
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some(item => deepEqualJsonValue(item, value))) {
      return false;
    }
  }

  const rawType = schema.type;
  const types = typeof rawType === 'string' ? [rawType] : Array.isArray(rawType) ? rawType : [];
  
  if (types.length > 0 && !types.some(type => typeof type === 'string' && matchesJsonSchemaType(type, value))) {
    return false;
  }

  return true;
}

/**
 * Ported directly from DemandAI for maximum fidelity.
 */
export function sanitizeSchema(schema: unknown): Record<string, unknown> {
  const stripped = stripSchemaKeywords(schema, OPENAI_INCOMPATIBLE_SCHEMA_KEYWORDS);
  if (!isSchemaRecord(stripped)) {
    return {};
  }

  const record = { ...stripped };

  if (isSchemaRecord(record.properties)) {
    const sanitizedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record.properties)) {
      sanitizedProps[key] = sanitizeSchema(value);
    }
    record.properties = sanitizedProps;
  }

  if ('items' in record) {
    if (Array.isArray(record.items)) {
      record.items = record.items.map(item => sanitizeSchema(item));
    } else {
      record.items = sanitizeSchema(record.items);
    }
  }

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(record[key])) {
      record[key] = record[key].map(item => sanitizeSchema(item as any));
    }
  }

  const properties = isSchemaRecord(record.properties) ? record.properties : undefined;
  if (Array.isArray(record.required) && properties) {
    record.required = record.required.filter(
      (value): value is string => typeof value === 'string' && value in properties,
    );
  }

  return record;
}
