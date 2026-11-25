import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFERRED_APP_TOOL_NAMES } from "@/config/tools";

const { mockToolSearch } = vi.hoisted(() => ({
  mockToolSearch: vi.fn((opts: { maxResults?: number }) => ({
    description: "mock search_app_tools",
    maxResults: opts?.maxResults,
  })),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    toolSearch: mockToolSearch,
  };
});

vi.mock("@/lib/app-tools/register-app-help-tool", () => ({
  registerAppHelpTool: () => ({ app_help: { description: "help" } }),
}));
vi.mock("@/lib/app-tools/register-inspect-workspace-tool", () => ({
  registerInspectWorkspaceTool: (
    _uid: string,
    opts?: { deferLoading?: boolean },
  ) => ({
    inspect_workspace: { deferLoading: opts?.deferLoading ?? true },
  }),
}));
vi.mock("@/lib/app-tools/register-manage-skill-tool", () => ({
  registerManageSkillTool: (
    _uid: string,
    opts?: { deferLoading?: boolean },
  ) => ({
    manage_skill: { deferLoading: opts?.deferLoading ?? true },
  }),
}));
vi.mock("@/lib/app-tools/register-manage-project-tool", () => ({
  registerManageProjectTool: (
    _uid: string,
    opts?: { deferLoading?: boolean },
  ) => ({
    manage_project: { deferLoading: opts?.deferLoading ?? true },
  }),
}));
vi.mock("@/lib/app-tools/register-manage-agent-tool", () => ({
  registerManageAgentTool: (
    _uid: string,
    opts?: { deferLoading?: boolean },
  ) => ({
    manage_agent: { deferLoading: opts?.deferLoading ?? true },
  }),
}));
vi.mock("@/lib/app-tools/register-manage-prompt-tool", () => ({
  registerManagePromptTool: (
    _uid: string,
    opts?: { deferLoading?: boolean },
  ) => ({
    manage_prompt: { deferLoading: opts?.deferLoading ?? true },
  }),
}));
vi.mock("@/lib/app-tools/register-manage-workflow-tool", () => ({
  registerManageWorkflowTool: (
    _uid: string,
    opts?: { deferLoading?: boolean },
  ) => ({
    manage_workflow: { deferLoading: opts?.deferLoading ?? true },
  }),
}));

import { registerAppTools } from "@/lib/app-tools/register-app-tools";

describe("registerAppTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers app_help, search_app_tools, and all 6 deferred tools by default", () => {
    const tools = registerAppTools("user-1");

    expect(Object.keys(tools).sort()).toEqual([
      "app_help",
      "inspect_workspace",
      "manage_agent",
      "manage_project",
      "manage_prompt",
      "manage_skill",
      "manage_workflow",
      "search_app_tools",
    ]);
    expect(mockToolSearch).toHaveBeenCalledWith({ maxResults: 6 });
    for (const name of DEFERRED_APP_TOOL_NAMES) {
      expect((tools[name] as { deferLoading?: boolean }).deferLoading).toBe(true);
    }
  });

  it("omits blocked app_help and individual deferred tools", () => {
    const tools = registerAppTools("user-1", {
      internalToolOverrides: {
        app_help: "block",
        manage_workflow: "block",
      },
    });

    expect(tools).not.toHaveProperty("app_help");
    expect(tools).not.toHaveProperty("manage_workflow");
    expect(tools).toHaveProperty("search_app_tools");
    expect(tools).toHaveProperty("manage_project");
  });

  it("omits manage_skill when includeManageSkill is false", () => {
    const tools = registerAppTools("user-1", { includeManageSkill: false });
    expect(tools).not.toHaveProperty("manage_skill");
    expect(tools).toHaveProperty("search_app_tools");
  });

  it("omits search_app_tools when all deferred tools are blocked or search_app_tools itself is blocked", () => {
    const allDeferredBlocked = registerAppTools("user-1", {
      internalToolOverrides: {
        inspect_workspace: "block",
        manage_skill: "block",
        manage_project: "block",
        manage_agent: "block",
        manage_prompt: "block",
        manage_workflow: "block",
      },
    });
    expect(allDeferredBlocked).toHaveProperty("app_help");
    expect(allDeferredBlocked).not.toHaveProperty("search_app_tools");
    expect(mockToolSearch).not.toHaveBeenCalled();

    const searchBlocked = registerAppTools("user-1", {
      internalToolOverrides: {
        search_app_tools: "block",
      },
    });
    expect(searchBlocked).not.toHaveProperty("search_app_tools");
  });

  it("sets deferLoading: false for preUnlockedToolNames and omits search_app_tools if none remain deferred", () => {
    const partialUnlock = registerAppTools("user-1", {
      preUnlockedToolNames: new Set(["manage_workflow"]),
    });
    expect(
      (partialUnlock.manage_workflow as { deferLoading?: boolean }).deferLoading,
    ).toBe(false);
    expect(
      (partialUnlock.manage_project as { deferLoading?: boolean }).deferLoading,
    ).toBe(true);
    expect(partialUnlock).toHaveProperty("search_app_tools");

    const fullUnlock = registerAppTools("user-1", {
      preUnlockedToolNames: new Set(DEFERRED_APP_TOOL_NAMES),
    });
    expect(fullUnlock).not.toHaveProperty("search_app_tools");
  });
});
