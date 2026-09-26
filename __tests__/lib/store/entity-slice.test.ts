import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
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

// Assistants
vi.mock("@/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
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

import { listAssistants as listAssistantsAction } from "@/actions/assistants/list-assistants";
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
  assistants: [],
  prompts: [],
  mcpServers: [],
};

const NOW = new Date().toISOString();

const makeProjectRow = (id: string, name = "Test Project") => ({
  id,
  name,
  description: null,
  globalPrompt: null,
  isPinned: false,
  userId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
});

const makeAssistantRow = (id: string, name = "Test Assistant") => ({
  id,
  name,
  description: null,
  prompt: null,
  avatar: null,
  userId: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
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

  it("starts with empty assistants array", () => {
    expect(useAppStore.getState().assistants).toEqual([]);
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

// ─── Assistants ────────────────────────────────────────────────────────────
describe("EntitySlice — Assistants", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("loadAssistants", () => {
    it("replaces assistants with rows from server action", async () => {
      vi.mocked(listAssistantsAction).mockResolvedValueOnce([
        makeAssistantRow("a1", "My Bot"),
      ]);
      await useAppStore.getState().loadAssistants();
      expect(useAppStore.getState().assistants[0].name).toBe("My Bot");
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
  });

  it("clears loadError on successful load", async () => {
    useAppStore.setState({ loadError: "Failed to load projects" });
    vi.mocked(listProjectsAction).mockResolvedValueOnce([makeProjectRow("p1")]);

    await useAppStore.getState().loadProjects();

    expect(useAppStore.getState().loadError).toBeNull();
    expect(useAppStore.getState().projects).toHaveLength(1);
  });

  it("resetEntityState clears loadError", () => {
    useAppStore.setState({ loadError: "Failed to load assistants" });
    useAppStore.getState().resetEntityState();
    expect(useAppStore.getState().loadError).toBeNull();
  });

  it("does not reject when the loader fails", async () => {
    vi.mocked(listAssistantsAction).mockRejectedValueOnce(new Error("boom"));
    await expect(
      useAppStore.getState().loadAssistants(),
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
        isPinned: false,
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
    expect(useAppStore.getState().assistants).toHaveLength(0);
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
      userId: "u1",
      theme: "dark",
      defaultModelId: "gpt-4",
    } as any);

    await useAppStore.getState().loadUserSettings();
    expect(useAppStore.getState().userSettings).toEqual({
      userId: "u1",
      theme: "dark",
      defaultModelId: "gpt-4",
    });
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
});
