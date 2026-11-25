import { describe, expect, it } from "vitest";
import {
  DEFERRED_APP_TOOL_NAMES,
  DEFAULT_ENABLED_TOOLS,
  getInternalToolDisplayName,
  groupToolsByCategory,
  INTERNAL_TOOL_CATALOGUE,
  INTERNAL_TOOL_IDS,
} from "@/config/tools";

describe("INTERNAL_TOOL_CATALOGUE", () => {
  it("gives every entry a unique id", () => {
    const ids = INTERNAL_TOOL_CATALOGUE.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry a non-empty name, displayName, description, and availability note", () => {
    for (const tool of INTERNAL_TOOL_CATALOGUE) {
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.displayName.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.availability.length).toBeGreaterThan(0);
      expect(tool.category.length).toBeGreaterThan(0);
    }
  });

  it("lists every tool the chat pipeline registers including app and consolidated skill tools", () => {
    const names = INTERNAL_TOOL_CATALOGUE.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "manage_artifact",
        "save_memory",
        "search_knowledge_base",
        "load_skill",
        "manage_skill",
        "app_help",
        "search_app_tools",
        "inspect_workspace",
        "manage_project",
        "manage_agent",
        "manage_prompt",
        "manage_workflow",
        "get_file_url",
        "interactive_ui",
      ]),
    );
    expect(names).not.toContain("create_skill");
    expect(names).not.toContain("update_skill");
    expect(names).not.toContain("write_skill_file");
    expect(names).not.toContain("read_skill_file");
    expect(names).not.toContain("delete_skill_file");
  });

  it("reuses the central ids rather than repeating their literals", () => {
    const artifact = INTERNAL_TOOL_CATALOGUE.find(
      (tool) => tool.name === "manage_artifact",
    );
    expect(artifact?.id).toBe(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);

    const manageSkill = INTERNAL_TOOL_CATALOGUE.find(
      (tool) => tool.name === "manage_skill",
    );
    expect(manageSkill?.id).toBe(INTERNAL_TOOL_IDS.MANAGE_SKILL);
    expect(INTERNAL_TOOL_IDS.APP_TOOLS).toBe("internal:tool:app_tools");
  });

  it("keeps manage_artifact and manage_skill default-enabled and catalogued", () => {
    const ids = new Set(INTERNAL_TOOL_CATALOGUE.map((tool) => tool.id));
    expect(DEFAULT_ENABLED_TOOLS).toContain(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
    expect(DEFAULT_ENABLED_TOOLS).toContain(INTERNAL_TOOL_IDS.MANAGE_SKILL);
    expect(ids.has(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT)).toBe(true);
    expect(ids.has(INTERNAL_TOOL_IDS.MANAGE_SKILL)).toBe(true);
  });

  it("exports DEFERRED_APP_TOOL_NAMES as the single source of truth for deferred tools", () => {
    expect(DEFERRED_APP_TOOL_NAMES).toEqual([
      "inspect_workspace",
      "manage_skill",
      "manage_project",
      "manage_agent",
      "manage_prompt",
      "manage_workflow",
    ]);
  });
});

describe("getInternalToolDisplayName", () => {
  it("resolves human readable names for internal tools and legacy skill aliases", () => {
    expect(getInternalToolDisplayName("search_knowledge_base")).toBe(
      "Search Knowledge Base",
    );
    expect(getInternalToolDisplayName("manage_artifact")).toBe("Artifact");
    expect(getInternalToolDisplayName("save_memory")).toBe("Save Memory");
    expect(getInternalToolDisplayName("app_help")).toBe("App Help");
    expect(getInternalToolDisplayName("search_app_tools")).toBe(
      "Search App Tools",
    );
    expect(getInternalToolDisplayName("inspect_workspace")).toBe(
      "Inspect Workspace",
    );
    expect(getInternalToolDisplayName("manage_skill")).toBe("Manage Skill");
    expect(getInternalToolDisplayName("manage_project")).toBe("Manage Project");
    expect(getInternalToolDisplayName("manage_agent")).toBe("Manage Agent");
    expect(getInternalToolDisplayName("manage_prompt")).toBe("Manage Prompt");
    expect(getInternalToolDisplayName("manage_workflow")).toBe(
      "Manage Workflow",
    );
    expect(getInternalToolDisplayName("create_skill")).toBe("Create Skill");
    expect(getInternalToolDisplayName("update_skill")).toBe("Update Skill");
    expect(getInternalToolDisplayName("write_skill_file")).toBe(
      "Write Skill File",
    );
    expect(getInternalToolDisplayName("read_skill_file")).toBe(
      "Read Skill File",
    );
    expect(getInternalToolDisplayName("delete_skill_file")).toBe(
      "Delete Skill File",
    );
  });

  it("returns undefined for external or unknown tools", () => {
    expect(getInternalToolDisplayName("external_api_call")).toBeUndefined();
    expect(getInternalToolDisplayName("unknown_tool")).toBeUndefined();
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
