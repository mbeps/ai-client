import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";

describe("ROUTES.SETTINGS.MEMORY", () => {
  it("defines memory settings route", () => {
    expect(ROUTES.SETTINGS.MEMORY).toBeDefined();
    expect(ROUTES.SETTINGS.MEMORY.path).toBe("/settings/memory");
    expect(ROUTES.SETTINGS.MEMORY.name).toBe("Memory");
  });
});

