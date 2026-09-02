import { describe, expect, it } from "vitest";
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

  it("mentions get_file_url tool and lists file names when attachments are present", () => {
    const result = buildSystemPrompt(null, null, null, false, [
      "data.xlsx",
      "report.csv",
    ]);
    expect(result).toContain("get_file_url");
    expect(result).toContain("data.xlsx");
    expect(result).toContain("report.csv");
    // No raw signed URLs should appear
    expect(result).not.toContain("https://example.com/signed");
  });

  it("does not include attachment section when attachmentNames is empty", () => {
    const result = buildSystemPrompt(null, null, null, false, []);
    expect(result).not.toContain("get_file_url");
  });

  it("falls back to a default prompt when all layers are empty", () => {
    const result = buildSystemPrompt(null, null, null, false);
    expect(result.length).toBeGreaterThan(0);
  });

  it("injects available skills catalog when tool calling is supported", () => {
    const availableSkills = [
      {
        name: "clean-code",
        displayName: "Clean Code",
        description: "Pragmatic code quality.",
      },
    ];
    const result = buildSystemPrompt(
      null,
      null,
      null,
      false,
      [],
      availableSkills,
      [],
      true,
    );
    expect(result).toContain("<available_skills>");
    expect(result).toContain("<name>clean-code</name>");
    expect(result).toContain("load_skill");
  });

  it("injects pre-selected skills with instructions and bundled files", () => {
    const selectedSkills = [
      {
        id: "s1",
        userId: "u1",
        name: "frontend-design",
        displayName: "Frontend Design",
        description: "UI standards",
        content: "# Frontend Guidelines",
        files: [{ path: "references/theme.md", content: "Theme rules" }],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = buildSystemPrompt(
      null,
      null,
      null,
      false,
      [],
      [],
      selectedSkills,
      true,
    );
    expect(result).toContain(
      "## Active Skill: Frontend Design (frontend-design)",
    );
    expect(result).toContain("# Frontend Guidelines");
    expect(result).toContain("Theme rules");
  });
});
