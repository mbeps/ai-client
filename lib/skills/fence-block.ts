/**
 * Wraps content in a Markdown code fence that the content cannot escape from.
 *
 * @decision A skill file is written by a language model, and its content is
 * interpolated straight into the system prompt. A triple backtick inside the
 * content would close the block early and let the rest of the file pose as
 * instructions. The fence is therefore always one backtick longer than the
 * longest run in the content, which is the rule the CommonMark parser uses.
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
