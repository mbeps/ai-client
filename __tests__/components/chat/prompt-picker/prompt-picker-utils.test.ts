import { describe, expect, it } from "vitest";
import {
  buildPromptItems,
  filterAccessiblePrompts,
  filterPromptsByQuery,
  groupPromptsByCategory,
  resolveInitialExpandedGroups,
} from "@/components/chat/prompt-picker/prompt-picker-utils";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";

const mockPrompts: Prompt[] = [
  {
    id: "p1",
    title: "Summarise Text",
    shortcut: "summarise",
    content: "Summarise the following input",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "p2",
    title: "Fix Grammar",
    shortcut: "grammar",
    description: "Fix typos and formatting",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockMcpPrompts: DiscoveredPrompt[] = [
  {
    name: "analyze-repo",
    description: "Analyze GitHub repository structure",
    arguments: [],
    serverId: "srv-github",
    serverName: "GitHub MCP",
  },
];

describe("buildPromptItems", () => {
  it("unifies local and MCP prompts into MentionPromptItem array", () => {
    const items = buildPromptItems(mockPrompts, mockMcpPrompts);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      id: "p1",
      title: "Summarise Text",
      isMcp: false,
    });
    expect(items[2]).toMatchObject({
      id: "mcp:srv-github:analyze-repo",
      title: "analyze-repo",
      isMcp: true,
      sourceServer: "GitHub MCP",
    });
  });

  it("handles empty input arrays gracefully", () => {
    expect(buildPromptItems([], [])).toEqual([]);
    expect(buildPromptItems()).toEqual([]);
  });
});

describe("filterPromptsByQuery", () => {
  const items = buildPromptItems(mockPrompts, mockMcpPrompts);

  it("returns all items when query is empty or whitespace", () => {
    expect(filterPromptsByQuery(items, "")).toEqual(items);
    expect(filterPromptsByQuery(items, "   ")).toEqual(items);
  });

  it("filters by title case-insensitively", () => {
    const result = filterPromptsByQuery(items, "summarise");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("filters by shortcut", () => {
    const result = filterPromptsByQuery(items, "grammar");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  it("filters by description", () => {
    const result = filterPromptsByQuery(items, "typos");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  it("filters by MCP server name", () => {
    const result = filterPromptsByQuery(items, "GitHub");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("mcp:srv-github:analyze-repo");
  });

  it("filters by content", () => {
    const result = filterPromptsByQuery(items, "following input");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("returns empty array when nothing matches", () => {
    expect(filterPromptsByQuery(items, "non-existent-xyz")).toEqual([]);
  });
});

describe("groupPromptsByCategory", () => {
  it("groups internal and MCP items into separate categories", () => {
    const items = buildPromptItems(mockPrompts, mockMcpPrompts);
    const groups = groupPromptsByCategory(
      items,
      mockMcpPrompts,
      false,
      mockPrompts.length > 0,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe("internal");
    expect(groups[0].name).toBe("Internal Prompts");
    expect(groups[0].items).toHaveLength(2);

    expect(groups[1].id).toBe("srv-github");
    expect(groups[1].name).toBe("GitHub MCP");
    expect(groups[1].items).toHaveLength(1);
  });

  it("preserves empty categories when no query is active", () => {
    const groups = groupPromptsByCategory([], mockMcpPrompts, false, false);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("srv-github");
    expect(groups[0].items).toHaveLength(0);
  });

  it("hides empty categories when search query is active", () => {
    const groups = groupPromptsByCategory([], mockMcpPrompts, true, true);
    expect(groups).toHaveLength(0);
  });
});

describe("resolveInitialExpandedGroups", () => {
  it("expands all groups when defaultExpanded is true", () => {
    const expanded = resolveInitialExpandedGroups(true, undefined, mockMcpPrompts);
    expect(expanded.has("internal")).toBe(true);
    expect(expanded.has("srv-github")).toBe(true);
  });

  it("expands groups that contain selected prompt IDs", () => {
    const selected = new Set(["mcp:srv-github:analyze-repo"]);
    const expanded = resolveInitialExpandedGroups(false, selected, mockMcpPrompts);
    expect(expanded.has("internal")).toBe(true);
    expect(expanded.has("srv-github")).toBe(true);
  });

  it("returns empty set when defaultExpanded is false and no prompts selected", () => {
    const expanded = resolveInitialExpandedGroups(false, new Set(), mockMcpPrompts);
    expect(expanded.size).toBe(0);
  });
});

describe("filterAccessiblePrompts", () => {
  const globalPrompt1: Prompt = {
    id: "g1",
    title: "Global 1",
    shortcut: "g1",
    content: "Global content 1",
    userId: "u1",
    projectIds: [],
    assistantIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const globalPrompt2: Prompt = {
    id: "g2",
    title: "Global 2",
    shortcut: "g2",
    content: "Global content 2",
    userId: "u1",
    projectIds: [],
    assistantIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectPromptA: Prompt = {
    id: "pA",
    title: "Proj A Prompt",
    shortcut: "pa",
    content: "Project A content",
    userId: "u1",
    projectIds: ["proj-a"],
    assistantIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectPromptB: Prompt = {
    id: "pB",
    title: "Proj B Prompt",
    shortcut: "pb",
    content: "Project B content",
    userId: "u1",
    projectIds: ["proj-b"],
    assistantIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const agentPrompt1: Prompt = {
    id: "agent1",
    title: "Agent 1 Prompt",
    shortcut: "a1",
    content: "Agent 1 content",
    userId: "u1",
    projectIds: [],
    agentIds: ["agent-1"],
    assistantIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dualPrompt: Prompt = {
    id: "dual1",
    title: "Dual Prompt",
    shortcut: "dual",
    content: "Dual content",
    userId: "u1",
    projectIds: ["proj-a", "proj-b"],
    agentIds: ["agent-1"],
    assistantIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const allPrompts: Prompt[] = [
    globalPrompt1,
    globalPrompt2,
    projectPromptA,
    projectPromptB,
    agentPrompt1,
    dualPrompt,
  ];

  it("in global chat: includes all global prompts and excludes entity-scoped prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {});
    expect(accessible.map((p) => p.id)).toEqual(["g1", "g2"]);
  });

  it("in project chat with promptMode 'all': includes current project prompts and all global prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      projectId: "proj-a",
      promptMode: "all",
    });
    expect(accessible.map((p) => p.id)).toEqual(["g1", "g2", "pA", "dual1"]);
  });

  it("in project chat with promptMode 'none': includes only current project prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      projectId: "proj-a",
      promptMode: "none",
    });
    expect(accessible.map((p) => p.id)).toEqual(["pA", "dual1"]);
  });

  it("in project chat with promptMode 'specific': includes current project prompts and allowed global prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      projectId: "proj-a",
      promptMode: "specific",
      allowedPromptIds: ["g2"],
    });
    expect(accessible.map((p) => p.id)).toEqual(["g2", "pA", "dual1"]);
  });

  it("in agent chat with promptMode 'all': includes current agent prompts and all global prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      agentId: "agent-1",
      promptMode: "all",
    });
    expect(accessible.map((p) => p.id)).toEqual(["g1", "g2", "agent1", "dual1"]);
  });

  it("in agent chat with promptMode 'none': includes only current agent prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      agentId: "agent-1",
      promptMode: "none",
    });
    expect(accessible.map((p) => p.id)).toEqual(["agent1", "dual1"]);
  });

  it("in agent chat with promptMode 'specific': includes current agent prompts and allowed global prompts", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      agentId: "agent-1",
      promptMode: "specific",
      allowedPromptIds: ["g1"],
    });
    expect(accessible.map((p) => p.id)).toEqual(["g1", "agent1", "dual1"]);
  });

  it("in chat with both project and agent: includes prompts matching either scope", () => {
    const accessible = filterAccessiblePrompts(allPrompts, {
      projectId: "proj-a",
      agentId: "agent-1",
      promptMode: "none",
    });
    expect(accessible.map((p) => p.id)).toEqual(["pA", "agent1", "dual1"]);
  });
});

