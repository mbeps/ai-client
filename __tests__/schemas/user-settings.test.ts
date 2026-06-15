import { describe, expect, it } from "vitest";
import { userSettingsSchema } from "@/schemas/user-settings";

describe("userSettingsSchema", () => {
  it("accepts empty payload", () => {
    const result = userSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts null global system prompt", () => {
    const result = userSettingsSchema.safeParse({
      globalSystemPrompt: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts prompt up to 5000 characters", () => {
    const result = userSettingsSchema.safeParse({
      globalSystemPrompt: "a".repeat(5000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects prompt above 5000 characters", () => {
    const result = userSettingsSchema.safeParse({
      globalSystemPrompt: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("strips legacy openrouterKey field", () => {
    const result = userSettingsSchema.safeParse({
      openrouterKey: "sk-or-legacy",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect("openrouterKey" in result.data).toBe(false);
    }
  });
});
