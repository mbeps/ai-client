import { describe, it, expect } from "vitest";
import {
  parseSkillMarkdown,
  formatSkillMarkdown,
  sanitizeSkillSlug,
  createSkillZip,
  extractSkillFromZip,
} from "@/lib/skills/parser";

describe("sanitizeSkillSlug", () => {
  it("normalizes mixed strings into valid slugs", () => {
    expect(sanitizeSkillSlug("Clean Code Style")).toBe("clean-code-style");
    expect(sanitizeSkillSlug("  My_Skill_123  ")).toBe("my-skill-123");
    expect(sanitizeSkillSlug("---leading-and-trailing---")).toBe(
      "leading-and-trailing",
    );
    expect(sanitizeSkillSlug("react-19/nextjs")).toBe("react-19-nextjs");
  });
});

describe("parseSkillMarkdown & formatSkillMarkdown", () => {
  it("parses valid SKILL.md with YAML frontmatter", () => {
    const raw = `---
name: careful-refactors
displayName: Careful Refactors
description: Make small, low-risk code changes.
---

# Instructions

Prefer minimal diffs.
Preserve public APIs.`;

    const parsed = parseSkillMarkdown(raw);
    expect(parsed.name).toBe("careful-refactors");
    expect(parsed.displayName).toBe("Careful Refactors");
    expect(parsed.description).toBe("Make small, low-risk code changes.");
    expect(parsed.content).toContain("Prefer minimal diffs.");
  });

  it("handles markdown without frontmatter using fallback", () => {
    const raw = `# Generic Skill\n\nAlways write tests first.`;
    const parsed = parseSkillMarkdown(raw, "test-first");
    expect(parsed.name).toBe("test-first");
    expect(parsed.displayName).toBe("Test First");
    expect(parsed.content).toBe(raw);
  });

  it("round-trips formatSkillMarkdown and parseSkillMarkdown", () => {
    const original = {
      name: "systematic-debugging",
      displayName: "Systematic Debugging",
      description: "Use when investigating unexpected test failures.",
      content: "# Debugging Guide\n1. Find root cause.",
    };

    const formatted = formatSkillMarkdown(original);
    const parsed = parseSkillMarkdown(formatted);

    expect(parsed.name).toBe(original.name);
    expect(parsed.displayName).toBe(original.displayName);
    expect(parsed.description).toBe(original.description);
    expect(parsed.content).toBe(original.content);
  });
});

describe("createSkillZip & extractSkillFromZip", () => {
  it("creates a zip bundle and extracts SKILL.md and reference files correctly", () => {
    const skillData = {
      name: "clean-code",
      displayName: "Clean Code",
      description: "Pragmatic code quality guidelines.",
      content:
        "# Clean Code\nRead references/checklist.md before writing code.",
      files: [
        {
          path: "references/checklist.md",
          content: "# Checklist\n- [ ] YAGNI\n- [ ] Simple interfaces",
        },
        {
          path: "templates/config.json",
          content: JSON.stringify({ strict: true }),
        },
      ],
    };

    const zipBuffer = createSkillZip(skillData);
    expect(zipBuffer.length).toBeGreaterThan(0);

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.name).toBe(skillData.name);
    expect(extracted.displayName).toBe(skillData.displayName);
    expect(extracted.description).toBe(skillData.description);
    expect(extracted.content).toContain("Read references/checklist.md");
    expect(extracted.files).toHaveLength(2);

    const checklistFile = extracted.files.find(
      (f) => f.path === "references/checklist.md",
    );
    expect(checklistFile).toBeDefined();
    expect(checklistFile?.content).toContain("- [ ] YAGNI");

    const templateFile = extracted.files.find(
      (f) => f.path === "templates/config.json",
    );
    expect(templateFile).toBeDefined();
    expect(templateFile?.content).toContain('"strict":true');
  });

  it("extracts zip where local headers have zero sizes (streaming / data descriptors)", () => {
    // Modify created zip so local header sizes are 0 and flag 0x08 is set
    const skillData = {
      name: "ai-sdk-nextjs",
      displayName: "AI SDK NextJS",
      description: "Guidelines for AI SDK v7.",
      content: "# AI SDK Guidelines\nAlways use streamText.",
      files: [{ path: "references/v7.md", content: "v7 details" }],
    };

    const zipBuffer = Buffer.from(createSkillZip(skillData));
    // Zero out compressed and uncompressed size in first local header (offsets 18 and 22)
    // and set bit 3 (0x08) in general purpose bit flag (offset 6)
    zipBuffer.writeUInt16LE(0x0008, 6);
    zipBuffer.writeUInt32LE(0, 18);
    zipBuffer.writeUInt32LE(0, 22);

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.name).toBe(skillData.name);
    expect(extracted.content).toBe(skillData.content);
    expect(extracted.files).toHaveLength(1);
    expect(extracted.files[0].content).toBe("v7 details");
  });
});
