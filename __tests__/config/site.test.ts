import { describe, expect, it } from "vitest";
import { SITE_CONFIG } from "@/config/site";

describe("config/site", () => {
  it("defines site name and description", () => {
    expect(SITE_CONFIG.NAME).toBe("AI Chat Client");
    expect(SITE_CONFIG.DESCRIPTION).toContain("AI chat client");
  });
});
