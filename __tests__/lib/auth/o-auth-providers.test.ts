import { describe, expect, it } from "vitest";
import { SUPPORTED_OAUTH_PROVIDERS, SUPPORTED_OAUTH_PROVIDER_DETAILS } from "@/lib/auth/o-auth-providers";

describe("o-auth-providers lib", () => {
  it("validates provider list entries", () => {
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain("google");
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain("github");
    expect(SUPPORTED_OAUTH_PROVIDERS).toContain("discord");
  });

  it("verifies details for all configured providers", () => {
    for (const p of SUPPORTED_OAUTH_PROVIDERS) {
      expect(SUPPORTED_OAUTH_PROVIDER_DETAILS[p]).toBeDefined();
      expect(SUPPORTED_OAUTH_PROVIDER_DETAILS[p].name).toBeDefined();
      expect(SUPPORTED_OAUTH_PROVIDER_DETAILS[p].Icon).toBeDefined();
    }
  });
});
