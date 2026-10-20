/**
 * Resolves the Inngest realtime API base URL in development.
 * In production or SSR, returns undefined so the Inngest SDK falls back to default cloud URLs.
 */
export function getRealtimeApiBaseUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (process.env.NODE_ENV !== "production") {
    return `${window.location.protocol}//${window.location.hostname}:8288`;
  }
  return undefined;
}
