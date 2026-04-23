/**
 * Races a promise against a timeout.
 * Used to prevent hanging MCP connections and tool discovery.
 *
 * @author Maruf Bepary
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
