/**
 * Extracts human-readable text from raw subagent execution results.
 *
 * @param result - Raw result returned by subagent execution
 * @returns Formatted output text
 * @author Maruf Bepary
 */
export function extractSubagentOutputText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";

  const r = result as Record<string, unknown>;
  if (Array.isArray(r.parts)) {
    const textParts = (r.parts as Array<{ type?: string; text?: string }>)
      .filter((p) => p?.type === "text" && typeof p?.text === "string")
      .map((p) => p.text as string);
    if (textParts.length > 0) return textParts.join("\n\n");
  }

  const fallback = r.summary || r.value || r.text;
  return typeof fallback === "string" ? fallback : "Task completed.";
}
