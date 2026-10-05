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
