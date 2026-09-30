import { describe, expect, it } from "vitest";
import {
  formatActiveSkill,
  formatSkillCatalog,
} from "@/lib/skills/build-skill-prompt";
import type { Skill, SkillSummary } from "@/types/skill/skill";

const baseSkill = {
  name: "pdf-report",
  displayName: "PDF Report",
  description: "Builds PDF reports",
  content: "Step 1. Read the data.",
} as unknown as Skill;

const summaries: SkillSummary[] = [
  {
    name: "pdf-report",
    displayName: "PDF Report",
    description: "Builds PDF reports",
  },
  { name: "xlsx-clean", displayName: "XLSX Clean", description: "Cleans workbooks" },
];

describe("formatActiveSkill", () => {
  it("renders the heading and content when there are no bundled files", () => {
    const output = formatActiveSkill({ ...baseSkill, files: [] } as Skill);

    expect(output).toBe(
      "## Active Skill: PDF Report (pdf-report)\nStep 1. Read the data.",
    );
  });

  it("renders the heading and content when files is undefined", () => {
    const { files: _files, ...skillWithoutFiles } = baseSkill as any;

    expect(formatActiveSkill(skillWithoutFiles as Skill)).toBe(
      "## Active Skill: PDF Report (pdf-report)\nStep 1. Read the data.",
    );
  });

  it("appends a bundled reference file section when files are present", () => {
    const output = formatActiveSkill({
      ...baseSkill,
      files: [{ path: "reference.md", content: "Extra guidance" }],
    } as unknown as Skill);

    expect(output).toBe(
      "## Active Skill: PDF Report (pdf-report)\n" +
        "Step 1. Read the data." +
        "\n\n### Bundled Reference Files:\n" +
        "#### File: reference.md\n```\nExtra guidance\n```",
    );
    expect(output).toContain("### Bundled Reference Files:");
    expect(output).toContain("#### File: reference.md");
    expect(output).toContain("Extra guidance");
  });

  it("joins multiple bundled files in order", () => {
    const output = formatActiveSkill({
      ...baseSkill,
      files: [
        { path: "a.md", content: "A" },
        { path: "b.md", content: "B" },
      ],
    } as unknown as Skill);

    expect(output).toContain("#### File: a.md\n```\nA\n```");
    expect(output).toContain("#### File: b.md\n```\nB\n```");
    expect(output.indexOf("a.md")).toBeLessThan(output.indexOf("b.md"));
  });
});

describe("formatSkillCatalog", () => {
  it("renders an empty <available_skills> block for an empty list", () => {
    const output = formatSkillCatalog([]);

    expect(output).toBe(
      "## Available Agent Skills\n" +
        "You have access to specialized agent skills for domain workflows.\n" +
        "If a task matches an available skill's description, call the `load_skill` tool with the skill's name to retrieve its full procedural instructions before responding.\n" +
        "\n<available_skills>\n\n</available_skills>",
    );
  });

  it("renders one <skill> entry per summary with name and description", () => {
    const output = formatSkillCatalog(summaries);

    expect(output).toContain(
      "<available_skills>\n" +
        "  <skill>\n" +
        "    <name>pdf-report</name>\n" +
        "    <description>Builds PDF reports</description>\n" +
        "  </skill>\n" +
        "  <skill>\n" +
        "    <name>xlsx-clean</name>\n" +
        "    <description>Cleans workbooks</description>\n" +
        "  </skill>\n" +
        "</available_skills>",
    );
    expect(output).toContain("load_skill");
    // displayName is intentionally not part of the catalog XML
    expect(output).not.toContain("PDF Report");
  });
});