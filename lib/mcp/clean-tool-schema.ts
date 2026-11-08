/**
 * Recursively removes `propertyNames` from a JSON Schema object in place.
 * LLM function calling specifications (OpenAI, Anthropic, Gemini, Groq)
 * do not support JSON Schema `propertyNames` constraints.
 *
 * @param schema - Target JSON schema object, array, or primitive
 * @returns The mutated schema with propertyNames stripped
 * @author Maruf Bepary
 */
export function removePropertyNamesInPlace<T>(schema: T): T {
  if (schema == null || typeof schema !== "object") {
    return schema;
  }

  if (Array.isArray(schema)) {
    for (const item of schema) {
      removePropertyNamesInPlace(item);
    }
    return schema;
  }

  delete (schema as Record<string, unknown>).propertyNames;

  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      removePropertyNamesInPlace(value);
    }
  }

  return schema;
}

/**
 * Cleans tool parameters/inputSchema of unsupported keywords before passing to AI SDK.
 *
 * @param toolDef - Tool definition containing inputSchema or parameters
 * @returns The tool definition with sanitized schema
 * @author Maruf Bepary
 */
export function cleanToolSchema<T>(toolDef: T): T {
  if (!toolDef || typeof toolDef !== "object") {
    return toolDef;
  }

  const def = toolDef as Record<string, any>;

  if (def.inputSchema) {
    if (def.inputSchema.jsonSchema) {
      removePropertyNamesInPlace(def.inputSchema.jsonSchema);
    } else {
      removePropertyNamesInPlace(def.inputSchema);
    }
  }

  if (def.parameters) {
    if (def.parameters.jsonSchema) {
      removePropertyNamesInPlace(def.parameters.jsonSchema);
    } else {
      removePropertyNamesInPlace(def.parameters);
    }
  }

  return toolDef;
}
