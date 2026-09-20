import { describe, expect, it, vi } from "vitest";
import { configureLogging, configureLoggingSync, getLogger, logger } from "@/lib/logger";

vi.mock("@/config/env", () => ({
  env: { LOG_LEVEL: "debug" },
}));

describe("lib/logger", () => {
  it("synchronously configures logging without error", () => {
    expect(() => configureLoggingSync()).not.toThrow();
  });

  it("asynchronously configures logging without error", async () => {
    await expect(configureLogging()).resolves.toBeUndefined();
  });

  it("returns a functional LogTape logger from getLogger", () => {
    const log = getLogger(["app", "test"]);
    expect(log).toBeDefined();
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");

    // Calling logging methods should not throw
    expect(() => log.debug("Test debug message")).not.toThrow();
    expect(() => log.info("Test info message with value {val}", { val: 42 })).not.toThrow();
    expect(() => log.warn("Test warn message")).not.toThrow();
    expect(() => log.error("Test error message: {err}", { err: "database failure" })).not.toThrow();
  });

  it("supports the backward-compatible logger facade", () => {
    expect(logger).toBeDefined();
    expect(() => logger.debug("Facade debug", { key: "value" })).not.toThrow();
    expect(() => logger.info("Facade info", { count: 10 })).not.toThrow();
    expect(() => logger.warn("Facade warn", { warning: true })).not.toThrow();
    expect(() => logger.error("Facade error", new Error("Boom"), { extra: "data" })).not.toThrow();
    expect(() => logger.error("Facade error with string", "string error")).not.toThrow();
    expect(() => logger.audit("Create Project", { userId: "user-123", name: "Test" })).not.toThrow();
  });

  it("handles configureSync throwing an error gracefully", async () => {
    vi.resetModules();
    vi.doMock("@logtape/logtape", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@logtape/logtape")>();
      return {
        ...actual,
        configureSync: vi.fn(() => {
          throw new Error("Already configured");
        }),
      };
    });

    const { configureLoggingSync: freshConfigure } = await import("@/lib/logger");
    expect(() => freshConfigure()).not.toThrow();

    vi.doUnmock("@logtape/logtape");
    vi.resetModules();
  });

  it("lazily initializes when getLogger is called first", async () => {
    vi.resetModules();
    const { getLogger: freshGetLogger } = await import("@/lib/logger");
    const log = freshGetLogger(["app", "lazy"]);
    expect(log).toBeDefined();
    vi.resetModules();
  });

  it("handles LOG_LEVEL env config and non-Error error details and audit traceId", async () => {
    vi.resetModules();
    const { configureLoggingSync: freshConfig, logger: freshLogger } = await import("@/lib/logger");
    expect(() => freshConfig()).not.toThrow();
    expect(() => freshLogger.error("msg", "string error", { ctxKey: 1 })).not.toThrow();
    expect(() => freshLogger.audit("TestAction", { userId: "user-1" }, "trace-999")).not.toThrow();
    vi.resetModules();
  });
});

