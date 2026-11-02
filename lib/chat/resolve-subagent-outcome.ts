/**
 * Resolves outcome label and error state for a subagent execution step.
 *
 * @param state - Current execution status of the subagent step
 * @param outputText - Extracted text output from the subagent
 * @returns Status label and whether the outcome is considered an error
 * @author Maruf Bepary
 */
export function resolveSubagentOutcome(
  state: "running" | "done" | "error",
  outputText: string,
): { label: string; isError: boolean } {
  if (state === "running") {
    return { label: "Delegating...", isError: false };
  }

  if (state === "error" || outputText.includes("STATUS: BLOCKED")) {
    return { label: "Blocked", isError: true };
  }

  if (outputText.includes("STATUS: DONE_WITH_CONCERNS")) {
    return { label: "Concerns", isError: false };
  }

  if (outputText.includes("STATUS: NEEDS_CONTEXT")) {
    return { label: "Needs Context", isError: false };
  }

  return { label: "Completed", isError: false };
}
