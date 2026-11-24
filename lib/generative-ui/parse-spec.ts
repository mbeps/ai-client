import { createSpecStreamCompiler, type Spec } from "@json-render/core";

/**
 * Maximum number of UI elements permitted in a single spec to prevent
 * runaway DOM trees or accidental infinite expansions from LLM output.
 */
export const MAX_UI_ELEMENTS = 150;

/**
 * Maximum total rendered node instances permitted when expanding shared DAG references,
 * preventing exponential blowup from multi-layer shared references.
 */
export const MAX_EXPANDED_UI_NODES = 1000;

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

function appendStringRefs(raw: unknown, out: string[]): boolean {
  if (!Array.isArray(raw)) {
    return false;
  }
  for (const childId of raw) {
    if (typeof childId !== "string") {
      return false;
    }
    out.push(childId);
  }
  return true;
}

function buildChildRefMap(
  elements: Record<string, unknown>,
): Map<string, string[]> | null {
  const refMap = new Map<string, string[]>();

  for (const [id, el] of Object.entries(elements)) {
    if (!isPlainRecord(el)) {
      return null;
    }
    const refs: string[] = [];
    if (el.children !== undefined && !appendStringRefs(el.children, refs)) {
      return null;
    }
    if (el.slots !== undefined) {
      if (!isPlainRecord(el.slots)) {
        return null;
      }
      for (const slotChildren of Object.values(el.slots)) {
        if (!appendStringRefs(slotChildren, refs)) {
          return null;
        }
      }
    }
    refMap.set(id, refs);
  }

  return refMap;
}

function hasCyclicChildren(refMap: Map<string, string[]>): boolean {
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

    const refs = refMap.get(id);
    if (refs) {
      for (const childId of refs) {
        if (visit(childId)) {
          return true;
        }
      }
    }

    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of refMap.keys()) {
    if (visit(id)) {
      return true;
    }
  }
  return false;
}

function exceedsExpandedNodeBudget(
  rootId: string,
  refMap: Map<string, string[]>,
  budget: number,
): boolean {
  let count = 0;
  const stack: string[] = [rootId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    const refs = refMap.get(id);
    if (!refs) {
      continue;
    }

    count += 1;
    if (count > budget) {
      return true;
    }

    for (const childId of refs) {
      stack.push(childId);
    }
  }

  return false;
}

/**
 * Parses either a JSONL RFC 6902 patch stream or a standalone `{ root, elements, state? }`
 * JSON object into a validated `Spec`, enforcing element count, expanded node budget, and acyclicity bounds.
 */
export function parseGenerativeUISpec(raw: string): ParseSpecResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty UI spec" };
  }

  let candidate: Spec;
  const standalone = tryParseStandaloneSpec(trimmed);
  if (standalone !== null) {
    candidate = standalone;
  } else {
    try {
      candidate = compileJsonlSpec(trimmed);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to compile UI spec",
      };
    }
  }

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

  const refMap = buildChildRefMap(candidate.elements);
  if (!refMap) {
    return {
      ok: false,
      error: "Invalid UI spec: child references must be arrays of strings",
    };
  }

  if (hasCyclicChildren(refMap)) {
    return {
      ok: false,
      error: "UI spec contains cyclic element references",
    };
  }

  if (
    exceedsExpandedNodeBudget(candidate.root, refMap, MAX_EXPANDED_UI_NODES)
  ) {
    return {
      ok: false,
      error: `UI spec exceeds maximum of ${MAX_EXPANDED_UI_NODES} rendered nodes`,
    };
  }

  return { ok: true, spec: candidate };
}
