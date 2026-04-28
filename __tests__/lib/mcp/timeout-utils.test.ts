import { withTimeout } from "@/lib/mcp/timeout-utils";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the promise value when promise settles before timeout", async () => {
    const promise = Promise.resolve(42);
    const result = await withTimeout(promise, 1000, "test");
    expect(result).toBe(42);
  });

  it("resolves with a string value", async () => {
    const promise = Promise.resolve("hello");
    const result = await withTimeout(promise, 1000, "test");
    expect(result).toBe("hello");
  });

  it("resolves with an object value", async () => {
    const value = { tools: ["tool1", "tool2"] };
    const promise = Promise.resolve(value);
    const result = await withTimeout(promise, 1000, "test");
    expect(result).toEqual(value);
  });

  it("rejects with timeout error when promise takes too long", async () => {
    const neverResolves = new Promise<never>(() => {});
    const racePromise = withTimeout(neverResolves, 500, "slow-server");

    vi.advanceTimersByTime(501);

    await expect(racePromise).rejects.toThrow(
      '[MCP] Connection to "slow-server" timed out after 500ms',
    );
  });

  it("includes label name in the timeout error message", async () => {
    const neverResolves = new Promise<never>(() => {});
    const racePromise = withTimeout(neverResolves, 1000, "my-mcp-server");

    vi.advanceTimersByTime(1001);

    await expect(racePromise).rejects.toThrow("my-mcp-server");
  });

  it("includes timeout duration in the timeout error message", async () => {
    const neverResolves = new Promise<never>(() => {});
    const racePromise = withTimeout(neverResolves, 2500, "server");

    vi.advanceTimersByTime(2501);

    await expect(racePromise).rejects.toThrow("2500ms");
  });

  it("propagates rejection from the original promise", async () => {
    const failing = Promise.reject(new Error("original error"));
    await expect(withTimeout(failing, 1000, "test")).rejects.toThrow(
      "original error",
    );
  });

  it("does not reject before the timeout elapses", async () => {
    let settled = false;
    const neverResolves = new Promise<never>(() => {});
    withTimeout(neverResolves, 1000, "server").catch(() => {
      settled = true;
    });

    vi.advanceTimersByTime(999);
    // Allow microtasks to flush
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("resolves to undefined when promise resolves with undefined", async () => {
    const promise = Promise.resolve(undefined);
    const result = await withTimeout(promise, 500, "test");
    expect(result).toBeUndefined();
  });

  it("clears the timer after resolution (no leaked timers)", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const promise = Promise.resolve("done");
    await withTimeout(promise, 5000, "test");
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("clears the timer even after rejection from promise", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const failing = Promise.reject(new Error("fail"));
    await withTimeout(failing, 5000, "test").catch(() => {});
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
