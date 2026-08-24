// ponytail: in-memory sliding window, single-instance only — resets on
// deploy/restart and does not share state across replicas. Upgrade path:
// Redis-backed @upstash/ratelimit when running multi-instance.
/** ponytail: exported only for tests to assert key pruning. */
export const windows = new Map<string, number[]>();

const WINDOW_MS = 60_000;

/**
 * In-memory sliding-window rate limiter keyed by arbitrary string.
 *
 * @param key - Unique bucket key, e.g. `chat:${userId}`.
 * @param limitPerMinute - Max requests allowed per 60s window.
 * @returns Whether the request is allowed; when blocked, seconds until retry.
 */
export function checkRateLimit(
  key: string,
  limitPerMinute: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const timestamps = (windows.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );

  if (timestamps.length === 0) {
    // Drop fully-expired keys so stale user entries don't accumulate forever.
    windows.delete(key);
  }

  if (timestamps.length >= limitPerMinute) {
    const oldest = timestamps[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + WINDOW_MS - now) / 1000),
      ),
    };
  }

  timestamps.push(now);
  windows.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
