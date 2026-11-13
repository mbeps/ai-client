import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Chat } from "@/types/chat/chat";

// ─── Safety-net mocks: prevent env/db/auth from loading ───────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/auth/auth", () => ({ auth: {} }));

// ─── Mock all server actions ───────────────────────────────────────────────
// Projects
vi.mock("@/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));

// Agents
vi.mock("@/actions/agents/list-agents", () => ({
  listAgents: vi.fn(),
}));

// Prompts
vi.mock("@/actions/prompts/list-prompts", () => ({ listPrompts: vi.fn() }));

// MCP Servers
vi.mock("@/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));

// Public MCP Servers
vi.mock("@/actions/mcp-servers/list-public-mcp-servers", () => ({
  listPublicMcpServers: vi.fn(),
}));

// Skills
vi.mock("@/actions/skills/list-skills", () => ({
  listSkills: vi.fn(),
}));

// Transform Agents
vi.mock("@/actions/transform-agents/list-transform-agents", () => ({
  listTransformAgents: vi.fn(),
}));

// User Settings
vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: vi.fn(),
}));

// Discover All Prompts
vi.mock("@/actions/mcp/discover-all-prompts", () => ({
  discoverAllPrompts: vi.fn(),
}));

import { listAgents as listAgentsAction } from "@/actions/agents/list-agents";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { listMcpServers as listMcpServersAction } from "@/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers as listPublicMcpServersAction } from "@/actions/mcp-servers/list-public-mcp-servers";
import { listSkills as listSkillsAction } from "@/actions/skills/list-skills";
import { listTransformAgents as listTransformAgentsAction } from "@/actions/transform-agents/list-transform-agents";
import { getUserSettings as getUserSettingsAction } from "@/actions/user-settings/get-user-settings";
import { discoverAllPrompts as discoverAllPromptsAction } from "@/actions/mcp/discover-all-prompts";
// ─── Import mocked modules for per-test configuration ─────────────────────
import { listProjects as listProjectsAction } from "@/actions/projects/list-projects";
import { listPrompts as listPromptsAction } from "@/actions/prompts/list-prompts";

// ─── Chat slice mocks (needed because entity-slice modifies chats too) ─────
vi.mock("@/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
vi.mock("@/actions/chats/delete-chat", () => ({ deleteChat: vi.fn() }));
vi.mock("@/actions/chats/rename-chat", () => ({ renameChat: vi.fn() }));
vi.mock("@/actions/chats/move-chat", () => ({ moveChat: vi.fn() }));
vi.mock("@/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("@/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn(),
}));
vi.mock("@/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────
const RESET_STATE = {
  chats: {} as Record<string, Chat>,
  projects: [],
  agents: [],
  prompts: [],
  mcpServers: [],
};

const NOW = new Date().toISOString();

const makeProjectRow = (id: string, name = "Test Project") => ({
  id,
  name,
  description: null,
  globalPrompt: null,
  userId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
});

const makeAgentRow = (
  id: string,
  name = "Test Agent",
  overrides: Record<string, unknown> = {},
) => ({
  id,
  name,
  description: null,
  prompt: null,
  subagentPrompt: null,
  modelId: null,
  knowledgebaseIds: [],
  tools: [],
  skillMode: "dynamic",
  skillIds: [],
  promptMode: "all",
  promptIds: [],
  subagentIds: [],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  usedByCount: 0,
  userId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makePromptRow = (id: string, title = "Test Prompt") => ({
  id,
  title,
  shortcut: "test",
  content: "Prompt content",
  userId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
});

const makeMcpRow = (id: string, name = "Test MCP") => ({
  id,
  name,
  url: "https://api.example.com/mcp",
  headers: null,
  enabled: true,
  isPublic: false,
  userId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
});

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("EntitySlice — initial state", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("starts with empty projects array", () => {
    expect(useAppStore.getState().projects).toEqual([]);
  });

  it("starts with empty agents array", () => {
    expect(useAppStore.getState().agents).toEqual([]);
  });

  it("starts with empty prompts array", () => {
    expect(useAppStore.getState().prompts).toEqual([]);
  });

  it("starts with empty mcpServers array", () => {
    expect(useAppStore.getState().mcpServers).toEqual([]);
  });
});

// ─── Projects ──────────────────────────────────────────────────────────────
describe("EntitySlice — Projects", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("loadProjects", () => {
    it("replaces projects with rows from server action", async () => {
      vi.mocked(listProjectsAction).mockResolvedValueOnce([
        makeProjectRow("p1", "Alpha"),
        makeProjectRow("p2", "Beta"),
      ]);
      await useAppStore.getState().loadProjects();
      const projects = useAppStore.getState().projects;
      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe("Alpha");
    });
  });
});

// ─── Agents ────────────────────────────────────────────────────────────────
describe("EntitySlice — Agents", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("loadAgents", () => {
    it("merges custom agents from server action with BUILT_IN_AGENTS", async () => {
      vi.mocked(listAgentsAction).mockResolvedValueOnce([
        makeAgentRow("a1", "My Bot", {
          subagentIds: ["builtin:researcher"],
          usedByCount: 0,
        }),
      ] as any);
      await useAppStore.getState().loadAgents();
      const agents = useAppStore.getState().agents;
      expect(agents).toHaveLength(1 + BUILT_IN_AGENTS.length);
      expect(agents[0].name).toBe("My Bot");
      expect(agents[0].isOrchestrator).toBe(true);
      expect(agents[0].isBuiltIn).toBe(false);
      expect(agents.some((a) => a.id === "builtin:researcher" && a.isBuiltIn)).toBe(
        true,
      );
    });

    it("handles Result failure in loadAgents without throwing", async () => {
      vi.mocked(listAgentsAction).mockResolvedValueOnce({
        ok: false,
        error: { code: "DB_ERROR", message: "DB down" },
      } as any);
      await useAppStore.getState().loadAgents();
      expect(useAppStore.getState().loadError).toBe("DB down");
    });

    it("handles Result success in loadAgents", async () => {
      vi.mocked(listAgentsAction).mockResolvedValueOnce({
        ok: true,
        value: [makeAgentRow("a2", "Result Bot")],
      } as any);
      await useAppStore.getState().loadAgents();
      expect(useAppStore.getState().loadError).toBeNull();
      expect(useAppStore.getState().agents[0].name).toBe("Result Bot");
    });
  });

  describe("deleteAgent", () => {
    it("removes agent and cascades unbind across chats, agents, and projects", () => {
      useAppStore.setState({
        agents: [
          {
            ...BUILT_IN_AGENTS[0],
            id: "leaf-1",
            name: "Leaf",
            isBuiltIn: false,
            subagentIds: [],
          },
          {
            ...BUILT_IN_AGENTS[0],
            id: "orch-1",
            name: "Orch",
            isBuiltIn: false,
            isOrchestrator: true,
            subagentIds: ["leaf-1", "builtin:researcher"],
          },
        ],
        projects: [
          {
            id: "proj-1",
            userId: "user-1",
            name: "Proj",
            description: "",
            globalPrompt: "",
            tools: [],
            skillMode: "dynamic",
            skillIds: [],
            promptMode: "all",
            promptIds: [],
            subagentIds: ["leaf-1"],
            knowledgebaseId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        chats: {
          "chat-1": {
            id: "chat-1",
            title: "Agent Chat",
            agentId: "leaf-1",
            assistantId: "leaf-1",
            messages: {},
            currentLeafId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      useAppStore.getState().deleteAgent("leaf-1");

      const state = useAppStore.getState();
      expect(state.agents.find((a) => a.id === "leaf-1")).toBeUndefined();
      const orch = state.agents.find((a) => a.id === "orch-1");
      expect(orch?.subagentIds).toEqual(["builtin:researcher"]);
      expect(orch?.isOrchestrator).toBe(true);
      expect(state.projects[0].subagentIds).toEqual([]);
      expect(state.chats["chat-1"].agentId).toBeUndefined();
      expect(state.chats["chat-1"].assistantId).toBeUndefined();
    });
  });
});

// ─── Prompts ───────────────────────────────────────────────────────────────
describe("EntitySlice — Prompts", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("loadPrompts", () => {
    it("replaces prompts with rows from server action", async () => {
      vi.mocked(listPromptsAction).mockResolvedValueOnce([
        makePromptRow("pr1", "My Prompt"),
      ]);
      await useAppStore.getState().loadPrompts();
      expect(useAppStore.getState().prompts[0].title).toBe("My Prompt");
    });
  });
});

// ─── MCP Servers ───────────────────────────────────────────────────────────
describe("EntitySlice — MCP Servers", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("loadMcpServers", () => {
    it("replaces mcpServers with rows from server action", async () => {
      vi.mocked(listMcpServersAction).mockResolvedValueOnce([
        makeMcpRow("m1", "My MCP"),
      ]);
      await useAppStore.getState().loadMcpServers();
      expect(useAppStore.getState().mcpServers[0].name).toBe("My MCP");
    });

    it("preserves isInstalled and installId for installed community servers", async () => {
      vi.mocked(listMcpServersAction).mockResolvedValueOnce([
        { ...makeMcpRow("m1", "Personal MCP"), isInstalled: false },
        {
          ...makeMcpRow("m2", "Community MCP"),
          headers: "[REDACTED]",
          isInstalled: true,
          installId: "inst-123",
        },
      ]);
      await useAppStore.getState().loadMcpServers();
      const servers = useAppStore.getState().mcpServers;
      expect(servers[0].isInstalled).toBe(false);
      expect(servers[0].installId).toBeUndefined();
      expect(servers[1].isInstalled).toBe(true);
      expect(servers[1].installId).toBe("inst-123");
      expect(servers[1].headers).toBe("[REDACTED]");
    });
  });
});

// ─── MED-04 loadError state ────────────────────────────────────────────────
describe("EntitySlice — loadError", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("sets loadError and preserves prior entity data on loader rejection", async () => {
    useAppStore.setState({ projects: [{ id: "p1" }] } as never);
    vi.mocked(listProjectsAction).mockRejectedValueOnce(new Error("boom"));

    await useAppStore.getState().loadProjects();

    expect(useAppStore.getState().loadError).toBe("Failed to load projects");
    expect(useAppStore.getState().projects).toEqual([{ id: "p1" }]);

    // Test Result ok: false with custom error message
    vi.mocked(listProjectsAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "Action error loading projects" },
    } as any);
    await useAppStore.getState().loadProjects();
    expect(useAppStore.getState().loadError).toBe("Action error loading projects");

    // Test Result ok: false with no error message (fallback)
    vi.mocked(listProjectsAction).mockResolvedValueOnce({
      ok: false,
      error: {},
    } as any);
    await useAppStore.getState().loadProjects();
    expect(useAppStore.getState().loadError).toBe("Failed to load projects");
  });

  it("clears loadError on successful load", async () => {
    useAppStore.setState({ loadError: "Failed to load projects" });
    vi.mocked(listProjectsAction).mockResolvedValueOnce([makeProjectRow("p1")]);

    await useAppStore.getState().loadProjects();

    expect(useAppStore.getState().loadError).toBeNull();
    expect(useAppStore.getState().projects).toHaveLength(1);
  });

  it("resetEntityState clears loadError", () => {
    useAppStore.setState({ loadError: "Failed to load agents" });
    useAppStore.getState().resetEntityState();
    expect(useAppStore.getState().loadError).toBeNull();
  });

  it("does not reject when the loader fails", async () => {
    vi.mocked(listAgentsAction).mockRejectedValueOnce(new Error("boom"));
    await expect(
      useAppStore.getState().loadAgents(),
    ).resolves.toBeUndefined();
  });
});

// ─── T5.4 reset actions ────────────────────────────────────────────────────
describe("T5.4 resetEntityState clears entity state", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("resets all entity arrays and userSettings to defaults", async () => {
    vi.mocked(listProjectsAction).mockResolvedValueOnce([
      {
        id: "p1",
        userId: "u1",
        name: "P1",
        description: null,
        globalPrompt: null,
        tools: [],
        knowledgebaseId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    await useAppStore.getState().loadProjects();
    expect(useAppStore.getState().projects).toHaveLength(1);
    useAppStore.getState().resetEntityState();
    expect(useAppStore.getState().projects).toHaveLength(0);
    expect(useAppStore.getState().agents).toHaveLength(0);
    expect(useAppStore.getState().prompts).toHaveLength(0);
    expect(useAppStore.getState().mcpServers).toHaveLength(0);
    expect(useAppStore.getState().publicMcpServers).toHaveLength(0);
    expect(useAppStore.getState().transformAgents).toHaveLength(0);
    expect(useAppStore.getState().mcpPrompts).toHaveLength(0);
    expect(useAppStore.getState().userSettings).toBeNull();
  });

  it("resetChatState clears chats", () => {
    useAppStore.setState((s) => ({
      ...s,
      chats: {
        c1: {
          id: "c1",
          title: "Chat",
          projectId: undefined,
          assistantId: undefined,
          knowledgebaseId: null,
          updatedAt: new Date(),
          messages: {},
          currentLeafId: null,
        },
      },
    }));
    expect(Object.keys(useAppStore.getState().chats)).toHaveLength(1);
    useAppStore.getState().resetChatState();
    expect(Object.keys(useAppStore.getState().chats)).toHaveLength(0);
  });

  it("loads skills into store", async () => {
    vi.mocked(listSkillsAction).mockResolvedValueOnce([
      {
        id: "sk-1",
        userId: "u1",
        name: "test-skill",
        displayName: "Test Skill",
        description: "Skill Description",
        content: "# Skill",
        files: [{ path: "ref.md", content: "ref" }] as any,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sk-2",
        userId: "u1",
        name: "test-skill-no-files",
        displayName: "No Files",
        description: "None",
        content: "# Skill",
        files: null as any,
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    await useAppStore.getState().loadSkills();
    const skills = useAppStore.getState().skills;
    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("test-skill");
    expect(skills[0].files).toHaveLength(1);
    expect(skills[1].files).toEqual([]);
  });

  it("loads transform agents with valid and invalid steps JSON", async () => {
    vi.mocked(listTransformAgentsAction).mockResolvedValueOnce([
      {
        id: "ta-1",
        userId: "u1",
        name: "Agent 1",
        description: "desc",
        globalContext: "context",
        modelId: "gpt-4",
        tools: ["tool-1"],
        knowledgeBaseIds: ["kb-1"],
        requiresFileUpload: true,
        steps: JSON.stringify([{ name: "step 1" }]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ta-2",
        userId: "u1",
        name: "Agent 2",
        description: null,
        globalContext: null,
        modelId: null,
        tools: null,
        knowledgeBaseIds: null,
        requiresFileUpload: false,
        steps: "invalid-json-steps",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    await useAppStore.getState().loadTransformAgents();
    const agents = useAppStore.getState().transformAgents;
    expect(agents).toHaveLength(2);
    expect(agents[0].steps).toHaveLength(1);
    expect(agents[1].steps).toEqual([]);
    expect(agents[1].description).toBe("");
  });

  it("loads public MCP servers into store", async () => {
    vi.mocked(listPublicMcpServersAction).mockResolvedValueOnce([
      {
        id: "pub-1",
        name: "Public Server",
        url: "http://pub.example.com",
        headers: null,
        enabled: true,
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    ]);

    await useAppStore.getState().loadPublicMcpServers();
    expect(useAppStore.getState().publicMcpServers).toHaveLength(1);
  });

  it("loads user settings into store", async () => {
    vi.mocked(getUserSettingsAction).mockResolvedValueOnce({
      ok: true,
      value: {
        userId: "u1",
        theme: "dark",
        defaultModelId: "gpt-4",
      },
    } as any);

    await useAppStore.getState().loadUserSettings();
    expect(useAppStore.getState().userSettings).toEqual({
      userId: "u1",
      theme: "dark",
      defaultModelId: "gpt-4",
    });
  });

  it("loadUserSettings clears loadError on success and sets it on failure", async () => {
    useAppStore.setState({ loadError: "Old error" });
    vi.mocked(getUserSettingsAction).mockResolvedValueOnce({
      ok: true,
      value: {
        userId: "u1",
        theme: "dark",
        defaultModelId: "gpt-4",
      },
    } as any);

    await useAppStore.getState().loadUserSettings();
    expect(useAppStore.getState().loadError).toBeNull();

    vi.mocked(getUserSettingsAction).mockRejectedValueOnce(new Error("failure"));
    await useAppStore.getState().loadUserSettings();
    expect(useAppStore.getState().loadError).toBe("Failed to load userSettings");

    vi.mocked(getUserSettingsAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "Server error getting settings" },
    } as any);
    await useAppStore.getState().loadUserSettings();
    expect(useAppStore.getState().loadError).toBe("Server error getting settings");

    vi.mocked(getUserSettingsAction).mockResolvedValueOnce({
      ok: false,
      error: {},
    } as any);
    await useAppStore.getState().loadUserSettings();
    expect(useAppStore.getState().loadError).toBe("Failed to load userSettings");
  });

  it("loads MCP prompts into store", async () => {
    vi.mocked(discoverAllPromptsAction).mockResolvedValueOnce([
      {
        name: "prompt-1",
        description: "mcp prompt",
        arguments: [],
        serverName: "S1",
      },
    ]);

    await useAppStore.getState().loadMcpPrompts();
    expect(useAppStore.getState().mcpPrompts).toHaveLength(1);
  });

  it("loadMcpPrompts clears loadError on success and sets it on failure", async () => {
    useAppStore.setState({ loadError: "Old error" });
    vi.mocked(discoverAllPromptsAction).mockResolvedValueOnce([]);

    await useAppStore.getState().loadMcpPrompts();
    expect(useAppStore.getState().loadError).toBeNull();

    vi.mocked(discoverAllPromptsAction).mockResolvedValueOnce({
      ok: true,
      value: [
        {
          name: "p1",
          description: "d1",
          arguments: [],
          serverName: "s1",
        },
      ],
    } as any);
    await useAppStore.getState().loadMcpPrompts();
    expect(useAppStore.getState().mcpPrompts).toHaveLength(1);
    expect(useAppStore.getState().loadError).toBeNull();

    vi.mocked(discoverAllPromptsAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "Failed discovery" },
    } as any);
    await useAppStore.getState().loadMcpPrompts();
    expect(useAppStore.getState().loadError).toBe("Failed discovery");

    vi.mocked(discoverAllPromptsAction).mockResolvedValueOnce({
      ok: false,
      error: {},
    } as any);
    await useAppStore.getState().loadMcpPrompts();
    expect(useAppStore.getState().loadError).toBe("Failed to load mcpPrompts");

    vi.mocked(discoverAllPromptsAction).mockRejectedValueOnce(new Error("failure"));
    await useAppStore.getState().loadMcpPrompts();
    expect(useAppStore.getState().loadError).toBe("Failed to load mcpPrompts");
  });

  it("loadAgents handles Result ok/error envelopes and default guardrails/usage", async () => {
    vi.mocked(listAgentsAction).mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: "agent-ok",
          userId: "u1",
          name: "Agent OK",
          description: null,
          prompt: null,
          subagentPrompt: null,
          modelId: null,
          knowledgebaseIds: undefined,
          tools: null,
          skillMode: "dynamic",
          skillIds: null,
          promptMode: null,
          promptIds: null,
          subagentIds: undefined,
          guardrails: { maxSteps: 10, scratchpadAccess: false, isolateTools: true },
          avatar: null,
          usedByCount: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "agent-defaults",
          userId: "u1",
          name: "Agent Defaults",
          description: null,
          prompt: null,
          subagentPrompt: null,
          modelId: null,
          knowledgebaseIds: null,
          tools: null,
          skillMode: "dynamic",
          skillIds: null,
          promptMode: null,
          promptIds: null,
          subagentIds: null,
          guardrails: null,
          avatar: null,
          usedByCount: undefined,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    await useAppStore.getState().loadAgents();
    expect(useAppStore.getState().loadError).toBeNull();
    const loaded = useAppStore.getState().agents.find((a) => a.id === "agent-ok");
    expect(loaded?.usedByCount).toBe(2);
    expect(loaded?.guardrails?.maxSteps).toBe(10);
    const defaulted = useAppStore
      .getState()
      .agents.find((a) => a.id === "agent-defaults");
    expect(defaulted?.usedByCount).toBe(0);
    expect(defaulted?.guardrails).toEqual(DEFAULT_AGENT_GUARDRAILS);

    vi.mocked(listAgentsAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "Agent fetch failed" },
    } as any);
    await useAppStore.getState().loadAgents();
    expect(useAppStore.getState().loadError).toBe("Agent fetch failed");

    vi.mocked(listAgentsAction).mockResolvedValueOnce({
      ok: false,
      error: {},
    } as any);
    await useAppStore.getState().loadAgents();
    expect(useAppStore.getState().loadError).toBe("Failed to load agents");
  });

  it("deleteAgent removes agent, strips subagentIds from agents/projects, and unbinds chats", () => {
    useAppStore.setState({
      agents: [
        {
          id: "leaf-1",
          userId: "u1",
          name: "Leaf",
          description: "",
          prompt: "",
          subagentPrompt: "",
          modelId: null,
          knowledgebaseIds: [],
          tools: [],
          skillMode: "dynamic",
          skillIds: [],
          promptMode: "all",
          promptIds: [],
          subagentIds: [],
          guardrails: DEFAULT_AGENT_GUARDRAILS,
          avatar: null,
          isBuiltIn: false,
          isOrchestrator: false,
          usedByCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "orch-1",
          userId: "u1",
          name: "Orchestrator",
          description: "",
          prompt: "",
          subagentPrompt: "",
          modelId: null,
          knowledgebaseIds: [],
          tools: [],
          skillMode: "dynamic",
          skillIds: [],
          promptMode: "all",
          promptIds: [],
          subagentIds: ["leaf-1"],
          guardrails: DEFAULT_AGENT_GUARDRAILS,
          avatar: null,
          isBuiltIn: false,
          isOrchestrator: true,
          usedByCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "unrelated-agent",
          userId: "u1",
          name: "Unrelated",
          description: "",
          prompt: "",
          subagentPrompt: "",
          modelId: null,
          knowledgebaseIds: [],
          tools: [],
          skillMode: "dynamic",
          skillIds: [],
          promptMode: "all",
          promptIds: [],
          subagentIds: [],
          guardrails: DEFAULT_AGENT_GUARDRAILS,
          avatar: null,
          isBuiltIn: false,
          isOrchestrator: false,
          usedByCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      projects: [
        {
          id: "proj-with-sub",
          userId: "u1",
          name: "Proj 1",
          description: "",
          globalPrompt: "",
          tools: [],
          skillMode: "dynamic",
          skillIds: [],
          promptMode: "all",
          promptIds: [],
          knowledgebaseId: null,
          subagentIds: ["leaf-1", "other"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "proj-no-sub",
          userId: "u1",
          name: "Proj 2",
          description: "",
          globalPrompt: "",
          tools: [],
          skillMode: "dynamic",
          skillIds: [],
          promptMode: "all",
          promptIds: [],
          knowledgebaseId: null,
          subagentIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      chats: {
        c1: {
          id: "c1",
          title: "Bound",
          agentId: "leaf-1",
          assistantId: "leaf-1",
          messages: {},
          currentLeafId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        c2: {
          id: "c2",
          title: "Unbound",
          agentId: "other",
          assistantId: "other",
          messages: {},
          currentLeafId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    });

    useAppStore.getState().deleteAgent("leaf-1");

    const state = useAppStore.getState();
    expect(state.agents.find((a) => a.id === "leaf-1")).toBeUndefined();
    const orch = state.agents.find((a) => a.id === "orch-1");
    expect(orch?.subagentIds).toEqual([]);
    expect(orch?.isOrchestrator).toBe(false);
    expect(
      state.projects.find((p) => p.id === "proj-with-sub")?.subagentIds,
    ).toEqual(["other"]);
    expect(
      state.projects.find((p) => p.id === "proj-no-sub")?.subagentIds,
    ).toEqual([]);
    expect(state.chats.c1.agentId).toBeUndefined();
    expect(state.chats.c1.assistantId).toBeUndefined();
    expect(state.chats.c2.agentId).toBe("other");
  });
});
