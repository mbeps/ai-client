import { NonRetriableError } from "inngest";

function resolvePath(
  context: Record<string, unknown>,
  rawPath: string,
): unknown {
  const normalized = rawPath.replace(/\[([^\]]+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);
  let current: unknown = context;

  for (const segment of segments) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function formatInterpolatedValue(value: unknown, asJson: boolean): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (asJson) {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Compiles `{{variableName.path}}` and `{{json variableName.path}}` expressions against workflow context.
 * Throws `NonRetriableError` on unclosed or empty mustache tags.
 */
export function compileWorkflowTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  if (!template) return "";

  let output = "";
  let cursor = 0;

  while (cursor < template.length) {
    const openIdx = template.indexOf("{{", cursor);
    if (openIdx === -1) {
      output += template.slice(cursor);
      break;
    }

    output += template.slice(cursor, openIdx);
    const closeIdx = template.indexOf("}}", openIdx + 2);
    if (closeIdx === -1) {
      throw new NonRetriableError(
        "Unclosed template tag '{{' in workflow expression",
      );
    }

    const rawExpr = template.slice(openIdx + 2, closeIdx).trim();
    if (!rawExpr) {
      throw new NonRetriableError(
        "Empty template expression '{{}}' in workflow template",
      );
    }

    const isJsonHelper = rawExpr.startsWith("json ");
    const pathExpr = isJsonHelper ? rawExpr.slice(5).trim() : rawExpr;
    const resolved = resolvePath(context, pathExpr);
    output += formatInterpolatedValue(resolved, isJsonHelper);
    cursor = closeIdx + 2;
  }

  return output;
}
