import { describe, expect, it, vi } from "vitest";
import { configureLogging, configureLoggingSync, getLogger, logger } from "@/lib/logger";

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
});

