/**
 * Next.js instrumentation hook to configure LogTape logging on server startup.
 * Runs once when a new Next.js server instance starts up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureLoggingSync } = await import("@/lib/logger");
    configureLoggingSync();
  }
}

/**
 * Global Next.js server error instrumentation hook.
 * Logs unhandled errors, request metadata, and digests across renders, API routes, and Server Actions.
 *
 * @param error - The caught exception or unhandled rejection
 * @param request - Request details (path, method, headers)
 * @param context - Routing context (routerKind, routePath, routeType)
 * @author Maruf Bepary
 */
export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  },
) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getLogger } = await import("@/lib/logger");
    const log = getLogger(["app", "instrumentation"]);
    const digest = (error as { digest?: string })?.digest;
    log.error(
      "Server error caught by instrumentation (digest: {digest}, path: {path}, method: {method}, routeType: {routeType}): {error}",
      {
        digest,
        path: request.path,
        method: request.method,
        routeType: context.routeType,
        routePath: context.routePath,
        error: error instanceof Error ? (error.stack ?? error.message) : error,
      },
    );
  }
}
