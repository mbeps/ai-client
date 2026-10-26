/**
 * Wraps content in a Markdown code fence that the content cannot escape from.
 *
 * @param content - Text content
 * @param language - Target language
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function fenceBlock(content: string, language?: string): string {
  const longestRun = Math.max(
    0,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  // A trailing newline stops a content run from merging with the closing fence.
  return `${fence}${language ?? ""}\n${content}\n${fence}`;
}
