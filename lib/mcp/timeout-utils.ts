/**
 * Races a promise against a timeout deadline.
 * Used throughout MCP integration to prevent hanging connections and tool discovery operations.
 * Automatically cleans up the timeout timer even if the promise resolves before the deadline.
 *
 * @param promise - Promise to race against timeout
 * @param ms - Timeout duration in milliseconds
 * @param label - Descriptive label included in timeout error message for debugging
 * @returns Result of the promise if it resolves before timeout
 * @throws {Error} When timeout expires before promise settles, with label and timeout duration in message
 * @see {@link build-transport.ts} for transport connection timeouts
 * @see {@link discover-tools.ts} for tool discovery timeouts
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(`[MCP] Connection to "${label}" timed out after ${ms}ms`),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId!),
  );
}
