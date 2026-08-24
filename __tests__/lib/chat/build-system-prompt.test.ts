import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";

describe("buildSystemPrompt (T4A.5 — plain string)", () => {
  it("returns a string, not an array of messages", () => {
    const result = buildSystemPrompt("global", null, null, false);
    expect(typeof result).toBe("string");
  });

  it("joins non-empty layers with \\n\\n---\\n\\n delimiters", () => {
    const result = buildSystemPrompt("GLOBAL", "PROJECT", "ASSISTANT", false);
    expect(result).toBe("GLOBAL\n\n---\n\nPROJECT\n\n---\n\nASSISTANT");
  });

  it("omits empty/null layers without leaving dangling delimiters", () => {
    const result = buildSystemPrompt(null, "PROJECT", null, false);
    expect(result).toBe("PROJECT");
  });

  it("treats whitespace-only layers as empty", () => {
    const result = buildSystemPrompt("   ", "PROJECT", undefined, false);
    expect(result).toBe("PROJECT");
  });

  it("appends KB instruction when hasKnowledgeBase is true", () => {
    const result = buildSystemPrompt(null, null, null, true);
    expect(result).toContain("knowledge");
    // No leading delimiter when it's the only layer
    expect(result.startsWith("\n")).toBe(false);
  });

  it("mentions get_file_url tool and contains no URLs when files are present", () => {
    const result = buildSystemPrompt(null, null, null, false, [
      { name: "data.xlsx", url: "https://example.com/signed" },
    ]);
    expect(result).toContain("get_file_url");
    expect(result).not.toContain("http");
  });

  it("falls back to a default prompt when all layers are empty", () => {
    const result = buildSystemPrompt(null, null, null, false);
    expect(result.length).toBeGreaterThan(0);
  });
});
