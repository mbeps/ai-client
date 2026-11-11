import {
  APICallError,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
} from "ai";
import { z } from "zod";

/**
 * Parameters for structured object generation with AI SDK `Output.object`.
 *
 * @author Maruf Bepary
 */
export interface GenerateStructuredObjectParams<T extends z.ZodTypeAny> {
  model: LanguageModel;
  schema: T;
  schemaName?: string;
  schemaDescription?: string;
  system: string;
  prompt: string;
  temperature?: number;
  /** Optional fallback transformer when JSON parses cleanly but misses strict schema constraints. */
  salvage?: (parsed: unknown) => z.infer<T> | null;
}

const PAIRED_REASONING_REGEX =
  /<(?:think|thinking|thought|reasoning)>[\s\S]*?<\/(?:think|thinking|thought|reasoning)>|\[THINK\][\s\S]*?\[\/THINK\]|◁think▷[\s\S]*?◁\/think▷/gi;

const DANGLING_REASONING_CLOSE_REGEX =
  /^[\s\S]*?(?:<\/(?:think|thinking|thought|reasoning)>|\[\/THINK\]|◁\/think▷)/i;

const CODE_FENCE_REGEX = /```(?:json)?\s*([\s\S]*?)\s*```/gi;

/**
 * Strips inline reasoning blocks as well as dangling closing reasoning tags
 * emitted when a model omits the opening delimiter.
 */
function stripReasoningBlocks(text: string): string {
  const withoutPaired = text.replace(PAIRED_REASONING_REGEX, "");
  return withoutPaired.replace(DANGLING_REASONING_CLOSE_REGEX, "").trim();
}

/**
 * Extracts balanced JSON object/array spans from arbitrary prose, ignoring
 * braces inside quoted string literals.
 */
function scanBalancedJsonSpans(text: string): string[] {
  const spans: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          spans.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return spans;
}

/**
 * Collects candidate JSON strings from markdown code fences and balanced spans.
 */
function collectJsonCandidates(text: string): string[] {
  const candidates = new Set<string>();
  for (const match of text.matchAll(CODE_FENCE_REGEX)) {
    const inner = match[1].trim();
    if (inner) candidates.add(inner);
  }
  for (const span of scanBalancedJsonSpans(text)) {
    candidates.add(span);
  }
  return Array.from(candidates);
}

/**
 * Parses a JSON candidate, tolerating trailing commas before closing brackets.
 */
function parseRelaxedJson(
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    const stripped = raw.replace(/,\s*([}\]])/g, "$1");
    try {
      return { ok: true, value: JSON.parse(stripped) };
    } catch {
      return { ok: false };
    }
  }
}

/**
 * Parses and validates raw LLM text against the target Zod schema,
 * optionally delegating partial recovery to `salvage`.
 */
function tryParseTextOutput<T extends z.ZodTypeAny>(
  rawText: string,
  schema: T,
  salvage?: (parsed: unknown) => z.infer<T> | null,
): z.infer<T> | null {
  const outer = stripReasoningBlocks(rawText);
  const sources = outer
    ? outer === rawText.trim()
      ? [outer]
      : [outer, rawText]
    : [rawText];

  for (const source of sources) {
    for (const candidate of collectJsonCandidates(source)) {
      const parsed = parseRelaxedJson(candidate);
      if (!parsed.ok) continue;

      const validated = schema.safeParse(parsed.value);
      if (validated.success) {
        return validated.data;
      }

      const salvaged = salvage ? salvage(parsed.value) : null;
      if (salvaged !== null) {
        return salvaged;
      }
    }
  }

  return null;
}

/**
 * Detects HTTP 400 errors where an OpenAI-compatible upstream provider
 * explicitly rejects structured `response_format` / `json_schema` requests.
 */
function isUnsupportedResponseFormatError(error: unknown): boolean {
  if (!APICallError.isInstance(error) || error.statusCode !== 400) {
    return false;
  }
  const details = `${error.message} ${error.responseBody ?? ""}`.toLowerCase();
  return (
    details.includes("response_format") ||
    details.includes("json_schema") ||
    details.includes("structured")
  );
}

/**
 * Generates a schema-validated object using AI SDK `Output.object`, with resilient
 * recovery when models wrap JSON in reasoning/fences, emit empty/malformed text under
 * `response_format`, or explicitly reject `json_schema`.
 *
 * @param params - Model, Zod schema, prompts, and optional salvage parser
 * @returns Validated structured output matching `schema`
 * @author Maruf Bepary
 */
export async function generateStructuredObject<T extends z.ZodTypeAny>({
  model,
  schema,
  schemaName,
  schemaDescription,
  system,
  prompt,
  temperature = 0,
  salvage,
}: GenerateStructuredObjectParams<T>): Promise<z.infer<T>> {
  try {
    const result = await generateText({
      model,
      output: Output.object({
        schema,
        name: schemaName,
        description: schemaDescription,
      }),
      system,
      prompt,
      temperature,
    });
    return result.output as z.infer<T>;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      const recovered = tryParseTextOutput(error.text, schema, salvage);
      if (recovered !== null) {
        return recovered;
      }
    }

    if (
      NoObjectGeneratedError.isInstance(error) ||
      isUnsupportedResponseFormatError(error)
    ) {
      const jsonSchema = z.toJSONSchema(schema);
      const fallback = await generateText({
        model,
        system: `${system}\n\nRespond with ONLY valid JSON matching this JSON Schema (no markdown fences or commentary):\n${JSON.stringify(jsonSchema)}`,
        prompt,
        temperature,
      });
      const recovered = fallback?.text
        ? tryParseTextOutput(fallback.text, schema, salvage)
        : null;
      if (recovered !== null) {
        return recovered;
      }
    }

    throw error;
  }
}
