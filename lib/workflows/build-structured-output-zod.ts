import { z } from "zod";
import type {
  StructuredOutputField,
  StructuredOutputSubfield,
} from "@/types/workflows/workflow";

function buildPrimitiveZodType(
  type: "string" | "number" | "boolean",
  description?: string,
): z.ZodTypeAny {
  const base =
    type === "string"
      ? z.string()
      : type === "number"
        ? z.number()
        : z.boolean();
  return description ? base.describe(description) : base;
}

function buildFieldZodType(field: StructuredOutputField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "string":
    case "number":
    case "boolean":
      schema = buildPrimitiveZodType(field.type, field.description);
      break;
    case "string_array":
      schema = z.array(z.string());
      break;
    case "number_array":
      schema = z.array(z.number());
      break;
    case "object_array": {
      const itemShape: Record<string, z.ZodTypeAny> = {};
      for (const sub of field.itemFields ??
        ([] as StructuredOutputSubfield[])) {
        const subSchema = buildPrimitiveZodType(sub.type, sub.description);
        itemShape[sub.name] = sub.required ? subSchema : subSchema.optional();
      }
      schema = z.array(z.object(itemShape));
      break;
    }
  }

  if (
    field.description &&
    field.type !== "string" &&
    field.type !== "number" &&
    field.type !== "boolean"
  ) {
    schema = schema.describe(field.description);
  }

  return field.required ? schema : schema.optional();
}

/**
 * Converts a visual `StructuredOutputField[]` definition into a runtime `z.ZodObject`
 * for `generateStructuredObject` validation and LLM schema generation.
 */
export function buildZodSchemaFromOutputFields(
  fields: StructuredOutputField[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.name] = buildFieldZodType(field);
  }
  return z.object(shape);
}

/**
 * Formats a structured output object as pretty-printed JSON for run summaries.
 */
export function formatStructuredOutputSummary(
  data: Record<string, unknown>,
): string {
  return JSON.stringify(data, null, 2);
}
