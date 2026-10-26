/**
 * Extracts a concise text summary from a subagent's execution output. Handles strings, UIMessage objects, structured results, and text parts.
 *
 * @param output - Target output
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractSubagentSummary(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  if (!output || typeof output !== "object") {
    return "Subagent finished with no text output.";
  }
  const r = output as Record<string, unknown>;
  if (typeof r.summary === "string" && r.summary.trim()) {
    return r.summary;
  }
  if (typeof r.value === "string" && r.value.trim()) {
    return r.value;
  }
  if (typeof r.text === "string" && r.text.trim()) {
    return r.text;
  }
  if (Array.isArray(r.parts)) {
    const textParts = (r.parts as Array<{ type?: string; text?: string }>)
      .filter(
        (p) =>
          p?.type === "text" && typeof p?.text === "string" && p.text.trim(),
      )
      .map((p) => p.text as string);
    if (textParts.length > 0) {
      const lastText = textParts[textParts.length - 1];
      if (
        lastText &&
        (lastText.includes("STATUS:") || textParts.length === 1)
      ) {
        return lastText;
      }
      return textParts.join("\n\n");
    }
  }
  return "Subagent finished with no text output.";
}

/**
 * Bounds subagent output to avoid context window bloat (default: 8,000 chars / ~2,000 tokens).
 *
 * @param output - Target output
 * @param maxChars - Target max chars
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function sanitizeSubagentOutput(
  output: unknown,
  maxChars = 8000,
): string {
  const text = extractSubagentSummary(output);
  if (text.length > maxChars) {
    return (
      text.slice(0, maxChars) +
      "\n\n[... Output truncated to 8,000 characters for context efficiency. Full details are stored in the scratchpad.]"
    );
  }
  return text;
}
