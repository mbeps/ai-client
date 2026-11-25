import { describe, expect, it } from "vitest";
import { DEFERRED_APP_TOOL_NAMES, INTERNAL_TOOL_IDS } from "@/config/tools";
import { resolveActiveContextToolNames } from "@/lib/chat/resolve-active-context-tools";

describe("resolveActiveContextToolNames", () => {
  it("returns empty array when supportsTools is false", () => {
    expect(
      resolveActiveContextToolNames({
        selectedTools: [INTERNAL_TOOL_IDS.MANAGE_ARTIFACT, "web_search"],
        supportsTools: false,
      }),
    ).toEqual([]);
  });

  it("strips MANAGE_SKILL and deferred tools and appends app_help + search_app_tools", () => {
    const result = resolveActiveContextToolNames({
      selectedTools: [
        INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
        INTERNAL_TOOL_IDS.MANAGE_SKILL,
        "inspect_workspace",
        "web_search",
      ],
      supportsTools: true,
    });

    expect(result).toEqual([
      INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
      "web_search",
      "app_help",
      "search_app_tools",
    ]);
  });

  it("strips blocked internal tools (manage_artifact, save_memory, delegate_task, search_knowledge_base)", () => {
    const result = resolveActiveContextToolNames({
      selectedTools: [
        INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
        INTERNAL_TOOL_IDS.MANAGE_MEMORY,
        INTERNAL_TOOL_IDS.DELEGATE_TASK,
        INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
        INTERNAL_TOOL_IDS.INTERACTIVE_UI,
      ],
      supportsTools: true,
      internalToolOverrides: {
        manage_artifact: "block",
        save_memory: "block",
        delegate_task: "block",
        search_knowledge_base: "block",
        interactive_ui: "block",
      },
    });

    expect(result).toEqual([
      "app_help",
      "search_app_tools",
    ]);
  });

  it("omits app_help and search_app_tools when blocked, or omits search_app_tools when all deferred tools are blocked", () => {
    const helpBlocked = resolveActiveContextToolNames({
      selectedTools: [],
      supportsTools: true,
      internalToolOverrides: { app_help: "block" },
    });
    expect(helpBlocked).toEqual(["search_app_tools"]);

    const searchBlocked = resolveActiveContextToolNames({
      selectedTools: [],
      supportsTools: true,
      internalToolOverrides: { search_app_tools: "block" },
    });
    expect(searchBlocked).toEqual(["app_help"]);

    const allDeferredBlocked = resolveActiveContextToolNames({
      selectedTools: [INTERNAL_TOOL_IDS.MANAGE_SKILL],
      supportsTools: true,
      internalToolOverrides: Object.fromEntries(
        DEFERRED_APP_TOOL_NAMES.map((name) => [name, "block" as const]),
      ),
    });
    expect(allDeferredBlocked).toEqual(["app_help"]);

    const nonSkillDeferredBlockedAndSkillUnselected = resolveActiveContextToolNames({
      selectedTools: [],
      supportsTools: true,
      internalToolOverrides: Object.fromEntries(
        DEFERRED_APP_TOOL_NAMES.filter((n) => n !== "manage_skill").map((name) => [
          name,
          "block" as const,
        ]),
      ),
    });
    expect(nonSkillDeferredBlockedAndSkillUnselected).toEqual(["app_help"]);
  });
});
