import { describe, expect, it } from "vitest";
import { userSettingsSchema } from "@/schemas/user/user-settings";

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

  it("accepts memoryEnabled boolean", () => {
    const resTrue = userSettingsSchema.safeParse({ memoryEnabled: true });
    expect(resTrue.success).toBe(true);
    expect(resTrue.data?.memoryEnabled).toBe(true);

    const resFalse = userSettingsSchema.safeParse({ memoryEnabled: false });
    expect(resFalse.success).toBe(true);
    expect(resFalse.data?.memoryEnabled).toBe(false);
  });

  it("has memoryEnabled column in Drizzle userSettings schema", async () => {
    const { userSettings } = await import(
      "@/drizzle/schemas/user-settings-schema"
    );
    expect(userSettings.memoryEnabled).toBeDefined();
    expect(userSettings.memoryEnabled.default).toBe(true);
  });
});
