import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat";

// ─── Safety-net mocks: prevent env/db/auth from loading ───────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    OPENROUTER_API_KEY: "test-key",
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
vi.mock("@/lib/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/lib/actions/projects/create-project", () => ({
  createProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/delete-project", () => ({
  deleteProject: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/projects/rename-project", () => ({
  renameProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/update-project", () => ({
  updateProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/toggle-pin-project", () => ({
  togglePinProject: vi.fn(),
}));

// Assistants
vi.mock("@/lib/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/create-assistant", () => ({
  createAssistant: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/delete-assistant", () => ({
  deleteAssistant: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/assistants/rename-assistant", () => ({
  renameAssistant: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/update-assistant", () => ({
  updateAssistant: vi.fn(),
}));

// Prompts
vi.mock("@/lib/actions/prompts/list-prompts", () => ({ listPrompts: vi.fn() }));
vi.mock("@/lib/actions/prompts/create-prompt", () => ({
  createPrompt: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/delete-prompt", () => ({
  deletePrompt: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/prompts/update-prompt", () => ({
  updatePrompt: vi.fn(),
}));

// MCP Servers
vi.mock("@/lib/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/create-mcp-server", () => ({
  createMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/delete-mcp-server", () => ({
  deleteMcpServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/mcp-servers/toggle-mcp-server", () => ({
  toggleMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/rename-mcp-server", () => ({
  renameMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/update-mcp-server", () => ({
  updateMcpServer: vi.fn(),
}));

// Knowledgebases (not tested but imported by entity-slice)
vi.mock("@/lib/actions/knowledgebases/rename-knowledgebase", () => ({
  renameKnowledgebase: vi.fn(),
}));

// ─── Import mocked modules for per-test configuration ─────────────────────
import { listProjects as listProjectsAction } from "@/lib/actions/projects/list-projects";
import { listAssistants as listAssistantsAction } from "@/lib/actions/assistants/list-assistants";
import { listPrompts as listPromptsAction } from "@/lib/actions/prompts/list-prompts";
import { listMcpServers as listMcpServersAction } from "@/lib/actions/mcp-servers/list-mcp-servers";

// ─── Chat slice mocks (needed because entity-slice modifies chats too) ─────
vi.mock("@/lib/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-chat", () => ({ deleteChat: vi.fn() }));
vi.mock("@/lib/actions/chats/rename-chat", () => ({ renameChat: vi.fn() }));
vi.mock("@/lib/actions/chats/move-chat", () => ({ moveChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-message-metadata", () => ({
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
  type: "stdio" as const,
  command: "python",
  args: null,
  url: null,
  headers: null,
  env: null,
  enabled: true,
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
