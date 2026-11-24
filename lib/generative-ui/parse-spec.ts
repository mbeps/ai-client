import {
  autoFixSpec,
  createSpecStreamCompiler,
  type Spec,
} from "@json-render/core";

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

const MAX_COND_DEPTH = 32;

const RESERVED_ELEMENT_KEYS = new Set([
  "type",
  "props",
  "children",
  "slots",
  "visible",
  "on",
  "repeat",
  "watch",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCondNode(
  obj: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  let cleanCond: unknown = obj.$cond;
  let innerThen: unknown;
  let innerElse: unknown;

  if (isPlainRecord(obj.$cond)) {
    const {
      then: rawThen,
      else: rawElse,
      $then: dollarThen,
      $else: dollarElse,
      ...restCond
    } = obj.$cond;
    cleanCond = restCond;
    innerThen = dollarThen ?? rawThen;
    innerElse = dollarElse ?? rawElse;
  }

  const thenBranch = obj.$then ?? obj.then ?? innerThen;
  const elseBranch = obj.$else ?? obj.else ?? innerElse;
  const out: Record<string, unknown> = { $cond: cleanCond };

  for (const [k, v] of Object.entries(obj)) {
    if (
      k !== "$cond" &&
      k !== "$then" &&
      k !== "$else" &&
      k !== "then" &&
      k !== "else"
    ) {
      out[k] = normalizeCondExpressions(v, depth + 1);
    }
  }
  if (thenBranch !== undefined) {
    out.$then = normalizeCondExpressions(thenBranch, depth + 1);
  }
  if (elseBranch !== undefined) {
    out.$else = normalizeCondExpressions(elseBranch, depth + 1);
  }
  return out;
}

function normalizeCondExpressions(value: unknown, depth = 0): unknown {
  if (depth > MAX_COND_DEPTH || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCondExpressions(item, depth + 1));
  }

  const obj = value as Record<string, unknown>;
  if ("$cond" in obj) {
    return normalizeCondNode(obj, depth);
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = normalizeCondExpressions(v, depth + 1);
  }
  return out;
}

function normalizeElementRecord(
  el: Record<string, unknown>,
): Record<string, unknown> {
  const nextProps: Record<string, unknown> = isPlainRecord(el.props)
    ? { ...el.props }
    : {};
  const nextEl: Record<string, unknown> = {};

  for (const field of ["children", "slots"] as const) {
    if (el[field] === undefined && nextProps[field] !== undefined) {
      nextEl[field] = nextProps[field];
      delete nextProps[field];
    }
  }

  for (const [key, val] of Object.entries(el)) {
    if (RESERVED_ELEMENT_KEYS.has(key)) {
      if (key !== "props") {
        nextEl[key] = val;
      }
    } else if (!(key in nextProps)) {
      nextProps[key] = val;
    }
  }

  nextEl.props = normalizeCondExpressions(nextProps);
  return nextEl;
}

function resolveUniqueTreeRoot(refMap: Map<string, string[]>): string | null {
  if (refMap.size <= 1) {
    return null;
  }

  const referenced = new Set<string>();
  for (const refs of refMap.values()) {
    for (const childId of refs) {
      referenced.add(childId);
    }
  }

  const unreferenced = [...refMap.keys()].filter((id) => !referenced.has(id));
  if (unreferenced.length !== 1) {
    return null;
  }

  const rootCandidate = unreferenced[0];
  const visited = new Set<string>();
  const stack = [rootCandidate];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    for (const childId of refMap.get(id)!) {
      if (refMap.has(childId)) {
        stack.push(childId);
      }
    }
  }

  return visited.size === refMap.size ? rootCandidate : null;
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
    const elRecord = el as Record<string, unknown>;
    const refs: string[] = [];
    if (
      elRecord.children !== undefined &&
      !appendStringRefs(elRecord.children, refs)
    ) {
      return null;
    }
    if (elRecord.slots !== undefined) {
      if (!isPlainRecord(elRecord.slots)) {
        return null;
      }
      for (const slotChildren of Object.values(elRecord.slots)) {
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

  const normalizedElements: Record<string, unknown> = {};
  for (const [id, el] of Object.entries(candidate.elements)) {
    if (!isPlainRecord(el)) {
      return {
        ok: false,
        error: "Invalid UI spec: child references must be arrays of strings",
      };
    }
    normalizedElements[id] = normalizeElementRecord(el);
  }

  let normalizedSpec = autoFixSpec(
    { ...candidate, elements: normalizedElements } as Spec,
    { lossy: false },
  ).spec;

  const refMap = buildChildRefMap(normalizedSpec.elements);
  if (!refMap) {
    return {
      ok: false,
      error: "Invalid UI spec: child references must be arrays of strings",
    };
  }

  if (!(normalizedSpec.root in normalizedSpec.elements)) {
    const recoveredRoot = resolveUniqueTreeRoot(refMap);
    if (!recoveredRoot) {
      return {
        ok: false,
        error: `Missing root element "${normalizedSpec.root}"`,
      };
    }
    normalizedSpec = { ...normalizedSpec, root: recoveredRoot };
  }

  if (hasCyclicChildren(refMap)) {
    return {
      ok: false,
      error: "UI spec contains cyclic element references",
    };
  }

  if (
    exceedsExpandedNodeBudget(
      normalizedSpec.root,
      refMap,
      MAX_EXPANDED_UI_NODES,
    )
  ) {
    return {
      ok: false,
      error: `UI spec exceeds maximum of ${MAX_EXPANDED_UI_NODES} rendered nodes`,
    };
  }

  return { ok: true, spec: normalizedSpec };
}
