import { describe, expect, it } from "vitest";
import { LANGUAGES, DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE } from "@/constants/languages";

describe("languages constants", () => {
  it("contains standard language codes and defaults", () => {
    expect(LANGUAGES.length).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_LANGUAGE).toBe("auto");
    expect(DEFAULT_TARGET_LANGUAGE).toBe("en");
  });
});
