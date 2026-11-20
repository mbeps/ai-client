const REASONING_BLOCK_RE =
  /<(think|thinking|thought|reasoning)>[\s\S]*?<\/\1>|\[THINK\][\s\S]*?\[\/THINK\]|◁think▷[\s\S]*?◁\/think▷/gi;
const UNCLOSED_REASONING_RE =
  /<(think|thinking|thought|reasoning)>[\s\S]*$|\[THINK\][\s\S]*$|◁think▷[\s\S]*$/i;

/**
 * Strips model reasoning blocks so internal chain-of-thought never leaks into
 * orchestrator context or UI worker findings.
 *
 * @param text - Raw text potentially containing reasoning delimiters
 * @returns Cleaned text without reasoning blocks
 * @author Maruf Bepary
 */
export function stripSubagentReasoning(text: string): string {
  return text
    .replace(REASONING_BLOCK_RE, "")
    .replace(UNCLOSED_REASONING_RE, "")
    .trim();
}

/**
 * Extracts human-readable text from raw subagent execution results.
 *
 * @param result - Raw result returned by subagent execution
 * @returns Formatted output text
 * @author Maruf Bepary
 */
export function extractSubagentOutputText(result: unknown): string {
  if (typeof result === "string") return stripSubagentReasoning(result);
  if (!result || typeof result !== "object") return "";

  const r = result as Record<string, unknown>;
  if (Array.isArray(r.parts)) {
    const textParts = (r.parts as Array<{ type?: string; text?: string }>)
      .filter((p) => p?.type === "text" && typeof p?.text === "string")
      .map((p) => p.text as string);
    if (textParts.length > 0) {
      return stripSubagentReasoning(textParts.join("\n\n"));
    }
  }

  const fallback = r.summary || r.value || r.text;
  return typeof fallback === "string"
    ? stripSubagentReasoning(fallback)
    : "Task completed.";
}
