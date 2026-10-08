import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENABLED_TOOLS,
  groupToolsByCategory,
  INTERNAL_TOOL_CATALOGUE,
  INTERNAL_TOOL_IDS,
} from "@/config/tools";

describe("INTERNAL_TOOL_CATALOGUE", () => {
  it("gives every entry a unique id", () => {
    const ids = INTERNAL_TOOL_CATALOGUE.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry a non-empty name, description, and availability note", () => {
    for (const tool of INTERNAL_TOOL_CATALOGUE) {
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.availability.length).toBeGreaterThan(0);
      expect(tool.category.length).toBeGreaterThan(0);
    }
  });

  it("lists every tool the chat pipeline registers", () => {
    const names = INTERNAL_TOOL_CATALOGUE.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "manage_artifact",
        "save_memory",
        "search_knowledge_base",
        "load_skill",
        "create_skill",
        "update_skill",
        "write_skill_file",
        "read_skill_file",
        "delete_skill_file",
        "get_file_url",
      ]),
    );
  });

  it("reuses the central ids rather than repeating their literals", () => {
    const artifact = INTERNAL_TOOL_CATALOGUE.find(
      (tool) => tool.name === "manage_artifact",
    );
    expect(artifact?.id).toBe(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
  });

  it("keeps the artifact id, which is both catalogued and default-enabled", () => {
    const ids = new Set(INTERNAL_TOOL_CATALOGUE.map((tool) => tool.id));
    expect(DEFAULT_ENABLED_TOOLS).toContain(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
    expect(ids.has(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT)).toBe(true);
  });

  it("documents that the manage_skill picker id has no registered tool", () => {
    // DEFAULT_ENABLED_TOOLS lists internal:tool:manage_skill so a later
    // permissions change can make it toggleable, but no tool() call registers
    // that name yet. The catalogue only lists real tools, so it must not gain
    // an entry for it until a tool is actually registered.
    expect(DEFAULT_ENABLED_TOOLS).toContain(INTERNAL_TOOL_IDS.MANAGE_SKILL);
    const ids = new Set(INTERNAL_TOOL_CATALOGUE.map((tool) => tool.id));
    expect(ids.has(INTERNAL_TOOL_IDS.MANAGE_SKILL)).toBe(false);
  });
});

describe("groupToolsByCategory", () => {
  it("keeps every tool, so grouping loses nothing", () => {
    const grouped = groupToolsByCategory();
    expect(grouped.flatMap(([, tools]) => tools)).toHaveLength(
      INTERNAL_TOOL_CATALOGUE.length,
    );
  });

  it("puts every tool in a section matching its own category", () => {
    for (const [category, tools] of groupToolsByCategory()) {
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.category).toBe(category);
      }
    }
  });

  it("orders sections by where each category first appears in the catalogue", () => {
    const firstSeen = [
      ...new Set(INTERNAL_TOOL_CATALOGUE.map((tool) => tool.category)),
    ];
    expect(groupToolsByCategory().map(([category]) => category)).toEqual(
      firstSeen,
    );
  });

  it("returns nothing for an empty list", () => {
    expect(groupToolsByCategory([])).toEqual([]);
  });

  it("keeps a single entry as its own section", () => {
    const [first] = INTERNAL_TOOL_CATALOGUE;
    const groups = groupToolsByCategory([first]);
    expect(groups).toEqual([[first.category, [first]]]);
  });

  it("does not mutate the catalogue it is given", () => {
    const before = INTERNAL_TOOL_CATALOGUE.length;
    groupToolsByCategory();
    expect(INTERNAL_TOOL_CATALOGUE).toHaveLength(before);
  });
});
