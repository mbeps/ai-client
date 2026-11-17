import { stripSubagentReasoning } from "@/lib/chat/extract-subagent-output";

/**
 * Extracts a concise text summary from a subagent's execution output. Handles strings, UIMessage objects, structured results, and text parts.
 *
 * @param output - Target output
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractSubagentSummary(output: unknown): string {
  let raw: string | null = null;
  if (typeof output === "string") {
    raw = output;
  } else if (output && typeof output === "object") {
    const r = output as Record<string, unknown>;
    if (typeof r.summary === "string" && r.summary.trim()) {
      raw = r.summary;
    } else if (typeof r.value === "string" && r.value.trim()) {
      raw = r.value;
    } else if (typeof r.text === "string" && r.text.trim()) {
      raw = r.text;
    } else if (Array.isArray(r.parts)) {
      const textParts = (r.parts as Array<{ type?: string; text?: string }>)
        .filter(
          (p) =>
            p?.type === "text" && typeof p?.text === "string" && p.text.trim(),
        )
        .map((p) => p.text as string);
      if (textParts.length > 0) {
        const lastText = textParts[textParts.length - 1];
        raw =
          lastText && (lastText.includes("STATUS:") || textParts.length === 1)
            ? lastText
            : textParts.join("\n\n");
      }
    }
  }

  const cleaned = raw ? stripSubagentReasoning(raw) : "";
  return cleaned || "Subagent finished with no text output.";
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
