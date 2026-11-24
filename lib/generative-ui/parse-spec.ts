import { createSpecStreamCompiler, type Spec } from "@json-render/core";

/**
 * Maximum number of UI elements permitted in a single spec to prevent
 * runaway DOM trees or accidental infinite expansions from LLM output.
 */
export const MAX_UI_ELEMENTS = 150;

export type ParseSpecResult =
  | { ok: true; spec: Spec }
  | { ok: false; error: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseStandaloneSpec(trimmed: string): Spec | null {
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isPlainRecord(parsed) && "root" in parsed && "elements" in parsed) {
      return parsed as unknown as Spec;
    }
    return null;
  } catch {
    return null;
  }
}

function compileJsonlSpec(trimmed: string): Spec {
  const compiler = createSpecStreamCompiler<Spec>();
  // Append trailing newline so the final JSONL patch line is always flushed.
  compiler.push(`${trimmed}\n`);
  return compiler.getResult();
}

function hasCyclicChildren(elements: Record<string, unknown>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }
    visiting.add(id);

    const el = elements[id];
    if (isPlainRecord(el) && Array.isArray(el.children)) {
      for (const childId of el.children) {
        if (typeof childId === "string" && visit(childId)) {
          return true;
        }
      }
    }

    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of Object.keys(elements)) {
    if (visit(id)) {
      return true;
    }
  }
  return false;
}

/**
 * Parses either a JSONL RFC 6902 patch stream or a standalone `{ root, elements, state? }`
 * JSON object into a validated `Spec`, enforcing element count and acyclicity bounds.
 */
export function parseGenerativeUISpec(raw: string): ParseSpecResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty UI spec" };
  }

  const candidate =
    tryParseStandaloneSpec(trimmed) ?? compileJsonlSpec(trimmed);

  if (
    !isPlainRecord(candidate) ||
    typeof candidate.root !== "string" ||
    candidate.root.length === 0 ||
    !isPlainRecord(candidate.elements)
  ) {
    return { ok: false, error: "Invalid UI spec: missing root or elements" };
  }

  const elementKeys = Object.keys(candidate.elements);
  if (elementKeys.length === 0) {
    return { ok: false, error: "Invalid UI spec: elements map is empty" };
  }

  if (elementKeys.length > MAX_UI_ELEMENTS) {
    return {
      ok: false,
      error: `UI spec exceeds maximum of ${MAX_UI_ELEMENTS} elements`,
    };
  }

  if (!(candidate.root in candidate.elements)) {
    return {
      ok: false,
      error: `Missing root element "${candidate.root}"`,
    };
  }

  if (hasCyclicChildren(candidate.elements)) {
    return {
      ok: false,
      error: "UI spec contains cyclic element references",
    };
  }

  return { ok: true, spec: candidate };
}
