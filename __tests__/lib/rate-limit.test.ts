import { describe, it, expect, beforeEach, vi } from "vitest";

describe("checkRateLimit", () => {
  let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

  beforeEach(async () => {
    vi.resetModules();
    ({ checkRateLimit } = await import("@/lib/rate-limit"));
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit("k1", 5);
      expect(result.allowed).toBe(true);
      expect(result.retryAfterSeconds).toBe(0);
    }
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k2", 5);
    const result = checkRateLimit("k2", 5);
    expect(result.allowed).toBe(false);
  });

  it("prunes timestamps older than 60s so the window slides", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      for (let i = 0; i < 5; i++) checkRateLimit("k3", 5);
      // Advance past the window: all old timestamps expire
      vi.setSystemTime(61_000);
      const result = checkRateLimit("k3", 5);
      expect(result.allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns retryAfterSeconds > 0 when blocked", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      for (let i = 0; i < 3; i++) checkRateLimit("k4", 3);
      vi.setSystemTime(10_000);
      const result = checkRateLimit("k4", 3);
      expect(result.allowed).toBe(false);
      // Oldest timestamp at t=0 expires at t=60 → retry after ~50s
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k5", 5);
    expect(checkRateLimit("k5", 5).allowed).toBe(false);
    expect(checkRateLimit("k6", 5).allowed).toBe(true);
  });

  it("deletes the Map entry when all timestamps expire (no stale keys)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      checkRateLimit("k7", 5);
      const { windows } = await import("@/lib/rate-limit");
      expect(windows.has("k7")).toBe(true);
      vi.setSystemTime(61_000);
      checkRateLimit("k7", 5);
      // Entry was pruned to empty and deleted, then re-created with one fresh hit
      expect(windows.get("k7")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
