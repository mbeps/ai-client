import { describe, expect, it, vi } from "vitest";
import { configureLogging, configureLoggingSync, getLogger, logger } from "@/lib/logger";

vi.mock("@/config/env", () => ({
  env: { LOG_LEVEL: "debug" },
}));

/**
 * Builds a LogTape mock with the dual export shape the module needs:
 * `getLogger` for the domain-scoped calls and a default `logger` facade.
 *
 * @param sink - Object whose debug/info/warn/error/audit methods record calls.
 * @returns Mock module factory suitable for `vi.doMock`.
 */
const logTapeMock = (sink: Record<string, ReturnType<typeof vi.fn>>) => ({
  configureSync: vi.fn(),
  getAnsiColorFormatter: vi.fn(() => ({})),
  getConsoleSink: vi.fn(() => ({})),
  getLogger: vi.fn(() => sink),
  logger: sink,
});

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

  it("defaults the log level to info when env.LOG_LEVEL is absent", async () => {
    vi.resetModules();
    vi.doMock("@/config/env", () => ({ env: {} }));
    const configureSync = vi.fn();
    vi.doMock("@logtape/logtape", () => {
      const sink = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const mock = logTapeMock(sink);
      return { ...mock, configureSync };
    });

    const { configureLoggingSync: freshConfigure } = await import(
      "@/lib/logger"
    );
    freshConfigure();

    // The `app` logger entry must fall back to the "info" default.
    const appLogger = configureSync.mock.calls[0][0].loggers.find(
      (l: { category: string[] }) => l.category.join() === "app",
    );
    expect(appLogger.lowestLevel).toBe("info");

    vi.doUnmock("@logtape/logtape");
    vi.doUnmock("@/config/env");
    vi.resetModules();
  });

  it("detects the test environment from VITEST alone, without NODE_ENV=test", async () => {
    // Vitest sets NODE_ENV=test, which short-circuits the first operand of the
    // isTest check, so Boolean(process.env.VITEST) is never evaluated there.
    // Clearing NODE_ENV forces evaluation of that second operand, and the
    // resulting isTest=true must reach the sink as nonBlocking: false.
    vi.resetModules();
    const getConsoleSink = vi.fn(() => ({}));
    vi.doMock("@logtape/logtape", () => {
      const sink = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      return { ...logTapeMock(sink), getConsoleSink };
    });
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VITEST", "true");

    const { configureLoggingSync: freshConfigure } = await import(
      "@/lib/logger"
    );
    freshConfigure();

    // nonBlocking: !isTest — isTest true means the sink must be blocking.
    expect(getConsoleSink).toHaveBeenCalledWith(
      expect.objectContaining({ nonBlocking: false }),
    );

    vi.unstubAllEnvs();
    vi.doUnmock("@logtape/logtape");
    vi.resetModules();
  });

  it("falls back to an empty context object when debug/info/warn get no context", async () => {
    // `ctx ?? {}` is the missing operand for all three facade levels.
    vi.resetModules();
    const debug = vi.fn();
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    vi.doMock("@logtape/logtape", () =>
      logTapeMock({ debug, info, warn, error }),
    );

    const { logger: freshLogger } = await import("@/lib/logger");
    freshLogger.debug("no ctx debug");
    freshLogger.info("no ctx info");
    freshLogger.warn("no ctx warn");

    expect(debug).toHaveBeenCalledWith("no ctx debug", {});
    expect(info).toHaveBeenCalledWith("no ctx info", {});
    expect(warn).toHaveBeenCalledWith("no ctx warn", {});

    vi.doUnmock("@logtape/logtape");
    vi.resetModules();
  });

  it("passes the context straight through when error is called with no error object", async () => {
    // Middle arm of the errorDetails ternary: err is undefined but ctx is given,
    // so errorDetails must be ctx itself — not `{}`.
    vi.resetModules();
    const error = vi.fn();
    vi.doMock("@logtape/logtape", () =>
      logTapeMock({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error }),
    );

    const { logger: freshLogger } = await import("@/lib/logger");
    const ctx = { requestId: "req-1" };
    freshLogger.error("boom without err", undefined, ctx);

    expect(error).toHaveBeenCalledWith("boom without err", ctx);
    expect(error.mock.calls[0][1]).toBe(ctx);

    vi.doUnmock("@logtape/logtape");
    vi.resetModules();
  });

  it("falls back to an empty context object when error gets neither error nor context", async () => {
    // Last arm of the ternary: (ctx ?? {}) with ctx undefined.
    vi.resetModules();
    const error = vi.fn();
    vi.doMock("@logtape/logtape", () =>
      logTapeMock({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error }),
    );

    const { logger: freshLogger } = await import("@/lib/logger");
    freshLogger.error("boom with nothing");

    expect(error).toHaveBeenCalledWith("boom with nothing", {});

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

