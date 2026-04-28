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
vi.mock("@/lib/actions/projects/toggle-project-pin", () => ({
  toggleProjectPin: vi.fn(),
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
vi.mock("@/lib/mcp/list-mcp-servers", () => ({ listMcpServers: vi.fn() }));
vi.mock("@/lib/mcp/create-mcp-server", () => ({ createMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/delete-mcp-server", () => ({
  deleteMcpServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/mcp/toggle-mcp-server", () => ({ toggleMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/rename-mcp-server", () => ({ renameMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/update-mcp-server", () => ({ updateMcpServer: vi.fn() }));

// Knowledgebases (not tested but imported by entity-slice)
vi.mock("@/lib/actions/knowledgebases/rename-knowledgebase", () => ({
  renameKnowledgebase: vi.fn(),
}));

// ─── Import mocked modules for per-test configuration ─────────────────────
import { listProjects as listProjectsAction } from "@/lib/actions/projects/list-projects";
import { createProject as createProjectAction } from "@/lib/actions/projects/create-project";
import { deleteProject as deleteProjectAction } from "@/lib/actions/projects/delete-project";
import { renameProject as renameProjectAction } from "@/lib/actions/projects/rename-project";
import { listAssistants as listAssistantsAction } from "@/lib/actions/assistants/list-assistants";
import { createAssistant as createAssistantAction } from "@/lib/actions/assistants/create-assistant";
import { deleteAssistant as deleteAssistantAction } from "@/lib/actions/assistants/delete-assistant";
import { renameAssistant as renameAssistantAction } from "@/lib/actions/assistants/rename-assistant";
import { listPrompts as listPromptsAction } from "@/lib/actions/prompts/list-prompts";
import { createPrompt as createPromptAction } from "@/lib/actions/prompts/create-prompt";
import { deletePrompt as deletePromptAction } from "@/lib/actions/prompts/delete-prompt";
import { listMcpServers as listMcpServersAction } from "@/lib/mcp/list-mcp-servers";
import { createMcpServer as createMcpServerAction } from "@/lib/mcp/create-mcp-server";
import { deleteMcpServer as deleteMcpServerAction } from "@/lib/mcp/delete-mcp-server";
import { toggleMcpServer as toggleMcpServerAction } from "@/lib/mcp/toggle-mcp-server";
import { renameMcpServer as renameMcpServerAction } from "@/lib/mcp/rename-mcp-server";
import { updateMcpServer as updateMcpServerAction } from "@/lib/mcp/update-mcp-server";
import { updateAssistant as updateAssistantAction } from "@/lib/actions/assistants/update-assistant";
import { updateProject as updateProjectAction } from "@/lib/actions/projects/update-project";
import { togglePinProject as togglePinProjectAction } from "@/lib/actions/projects/toggle-pin-project";
import { updatePrompt as updatePromptAction } from "@/lib/actions/prompts/update-prompt";
import { renameKnowledgebase as renameKnowledgebaseAction } from "@/lib/actions/knowledgebases/rename-knowledgebase";

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
  knowledgebases: [],
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

  describe("toggleProjectPin", () => {
    it("sets isPinned to true when project is unpinned", () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      useAppStore.getState().toggleProjectPin("p1");
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p1")?.isPinned,
      ).toBe(true);
    });

    it("sets isPinned to false when project is pinned", () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: true,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      useAppStore.getState().toggleProjectPin("p1");
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p1")?.isPinned,
      ).toBe(false);
    });

    it("does not affect other projects", () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
          {
            id: "p2",
            name: "P2",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      useAppStore.getState().toggleProjectPin("p1");
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p2")?.isPinned,
      ).toBe(false);
    });
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

  describe("createProjectDb", () => {
    it("prepends new project to the store after server action", async () => {
      vi.mocked(createProjectAction).mockResolvedValueOnce(
        makeProjectRow("p-new", "New Proj"),
      );
      const id = await useAppStore
        .getState()
        .createProjectDb({ name: "New Proj" });
      expect(id).toBe("p-new");
      expect(useAppStore.getState().projects[0].name).toBe("New Proj");
    });
  });

  describe("renameProjectDb", () => {
    it("updates the project name in store after server action", async () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "Old",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(renameProjectAction).mockResolvedValueOnce({
        ...makeProjectRow("p1", "Renamed"),
        updatedAt: NOW,
      });
      await useAppStore.getState().renameProjectDb("p1", "Renamed");
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p1")?.name,
      ).toBe("Renamed");
    });
  });

  describe("deleteProjectDb", () => {
    it("removes project from store after server action", async () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(deleteProjectAction).mockResolvedValueOnce(undefined);
      await useAppStore.getState().deleteProjectDb("p1");
      expect(useAppStore.getState().projects).toHaveLength(0);
    });

    it("unlinks associated chats by clearing their projectId", async () => {
      const chatId = useAppStore.getState().createChat("p1");
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(deleteProjectAction).mockResolvedValueOnce(undefined);
      await useAppStore.getState().deleteProjectDb("p1");
      expect(useAppStore.getState().chats[chatId].projectId).toBeUndefined();
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

  describe("createAssistantDb", () => {
    it("prepends new assistant to the store after server action", async () => {
      vi.mocked(createAssistantAction).mockResolvedValueOnce(
        makeAssistantRow("a-new", "New Bot"),
      );
      const id = await useAppStore
        .getState()
        .createAssistantDb({ name: "New Bot" });
      expect(id).toBe("a-new");
      expect(useAppStore.getState().assistants[0].name).toBe("New Bot");
    });
  });

  describe("renameAssistantDb", () => {
    it("updates assistant name in store after server action", async () => {
      useAppStore.setState({
        assistants: [
          {
            id: "a1",
            name: "Old",
            description: "",
            prompt: "",
            tools: [],
            knowledgebases: [],
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(renameAssistantAction).mockResolvedValueOnce({
        ...makeAssistantRow("a1", "Renamed"),
        updatedAt: NOW,
      });
      await useAppStore.getState().renameAssistantDb("a1", "Renamed");
      expect(
        useAppStore.getState().assistants.find((a) => a.id === "a1")?.name,
      ).toBe("Renamed");
    });
  });

  describe("deleteAssistantDb", () => {
    it("removes assistant from store after server action", async () => {
      useAppStore.setState({
        assistants: [
          {
            id: "a1",
            name: "Bot",
            description: "",
            prompt: "",
            tools: [],
            knowledgebases: [],
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(deleteAssistantAction).mockResolvedValueOnce(undefined);
      await useAppStore.getState().deleteAssistantDb("a1");
      expect(useAppStore.getState().assistants).toHaveLength(0);
    });

    it("unlinks chats by clearing their assistantId", async () => {
      const chatId = useAppStore.getState().createChat(undefined, "a1");
      useAppStore.setState({
        assistants: [
          {
            id: "a1",
            name: "Bot",
            description: "",
            prompt: "",
            tools: [],
            knowledgebases: [],
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(deleteAssistantAction).mockResolvedValueOnce(undefined);
      await useAppStore.getState().deleteAssistantDb("a1");
      expect(useAppStore.getState().chats[chatId].assistantId).toBeUndefined();
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

  describe("createPromptDb", () => {
    it("prepends new prompt to the store after server action", async () => {
      vi.mocked(createPromptAction).mockResolvedValueOnce(
        makePromptRow("pr-new", "New Prompt"),
      );
      const id = await useAppStore
        .getState()
        .createPromptDb({
          title: "New Prompt",
          shortcut: "np",
          content: "content",
        });
      expect(id).toBe("pr-new");
      expect(useAppStore.getState().prompts[0].title).toBe("New Prompt");
    });
  });

  describe("deletePromptDb", () => {
    it("removes prompt from store after server action", async () => {
      useAppStore.setState({
        prompts: [
          {
            id: "pr1",
            title: "Old",
            shortcut: "old",
            content: "content",
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(deletePromptAction).mockResolvedValueOnce(undefined);
      await useAppStore.getState().deletePromptDb("pr1");
      expect(useAppStore.getState().prompts).toHaveLength(0);
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

  describe("addMcpServer", () => {
    it("prepends new MCP server to the store after server action", async () => {
      vi.mocked(createMcpServerAction).mockResolvedValueOnce(
        makeMcpRow("m-new", "New MCP"),
      );
      await useAppStore
        .getState()
        .addMcpServer({ type: "stdio", name: "New MCP", command: "python" });
      expect(useAppStore.getState().mcpServers[0].name).toBe("New MCP");
    });
  });

  describe("removeMcpServer", () => {
    it("removes MCP server from store after server action", async () => {
      useAppStore.setState({
        mcpServers: [
          {
            id: "m1",
            name: "MCP",
            type: "stdio",
            command: "python",
            args: null,
            url: null,
            headers: null,
            env: null,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(deleteMcpServerAction).mockResolvedValueOnce(undefined);
      await useAppStore.getState().removeMcpServer("m1");
      expect(useAppStore.getState().mcpServers).toHaveLength(0);
    });
  });

  describe("toggleMcpServer", () => {
    it("updates enabled status after server action", async () => {
      useAppStore.setState({
        mcpServers: [
          {
            id: "m1",
            name: "MCP",
            type: "stdio",
            command: "python",
            args: null,
            url: null,
            headers: null,
            env: null,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(toggleMcpServerAction).mockResolvedValueOnce({
        ...makeMcpRow("m1"),
        enabled: false,
      });
      await useAppStore.getState().toggleMcpServer("m1");
      expect(useAppStore.getState().mcpServers[0].enabled).toBe(false);
    });
  });

  describe("renameMcpServer", () => {
    it("updates name after server action", async () => {
      useAppStore.setState({
        mcpServers: [
          {
            id: "m1",
            name: "Old MCP",
            type: "stdio",
            command: "python",
            args: null,
            url: null,
            headers: null,
            env: null,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(renameMcpServerAction).mockResolvedValueOnce({
        ...makeMcpRow("m1", "Renamed MCP"),
      });
      await useAppStore.getState().renameMcpServer("m1", "Renamed MCP");
      expect(useAppStore.getState().mcpServers[0].name).toBe("Renamed MCP");
    });
  });

  describe("updateMcpServer", () => {
    it("updates MCP server in store after server action", async () => {
      useAppStore.setState({
        mcpServers: [
          {
            id: "m1",
            name: "Old MCP",
            type: "stdio",
            command: "old-cmd",
            args: null,
            url: null,
            headers: null,
            env: null,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(updateMcpServerAction).mockResolvedValueOnce({
        ...makeMcpRow("m1", "Updated MCP"),
        command: "new-cmd",
        updatedAt: NOW,
      });
      await useAppStore
        .getState()
        .updateMcpServer("m1", {
          type: "stdio",
          name: "Updated MCP",
          command: "new-cmd",
        });
      expect(useAppStore.getState().mcpServers[0].name).toBe("Updated MCP");
      expect(useAppStore.getState().mcpServers[0].command).toBe("new-cmd");
    });

    it("does not affect other MCP servers", async () => {
      useAppStore.setState({
        mcpServers: [
          {
            id: "m1",
            name: "MCP-1",
            type: "stdio",
            command: "cmd1",
            args: null,
            url: null,
            headers: null,
            env: null,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "m2",
            name: "MCP-2",
            type: "stdio",
            command: "cmd2",
            args: null,
            url: null,
            headers: null,
            env: null,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      vi.mocked(updateMcpServerAction).mockResolvedValueOnce({
        ...makeMcpRow("m1", "Updated MCP-1"),
        command: "cmd1",
        updatedAt: NOW,
      });
      await useAppStore
        .getState()
        .updateMcpServer("m1", {
          type: "stdio",
          name: "Updated MCP-1",
          command: "cmd1",
        });
      expect(
        useAppStore.getState().mcpServers.find((s) => s.id === "m2")?.name,
      ).toBe("MCP-2");
    });
  });
});

// ─── Additional slice functions ─────────────────────────────────────────────
describe("EntitySlice — loadProjectRows / loadAssistantRows", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("loadProjectRows", () => {
    it("replaces projects synchronously from row data", () => {
      useAppStore
        .getState()
        .loadProjectRows([
          makeProjectRow("p1", "Alpha"),
          makeProjectRow("p2", "Beta"),
        ]);
      const projects = useAppStore.getState().projects;
      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe("Alpha");
    });

    it("overwrites existing projects", () => {
      useAppStore.setState({
        projects: [
          {
            id: "old",
            name: "Old",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      useAppStore
        .getState()
        .loadProjectRows([makeProjectRow("p-new", "Fresh")]);
      expect(useAppStore.getState().projects).toHaveLength(1);
      expect(useAppStore.getState().projects[0].name).toBe("Fresh");
    });
  });

  describe("loadAssistantRows", () => {
    it("replaces assistants synchronously from row data", () => {
      useAppStore
        .getState()
        .loadAssistantRows([
          makeAssistantRow("a1", "Bot One"),
          makeAssistantRow("a2", "Bot Two"),
        ]);
      const assistants = useAppStore.getState().assistants;
      expect(assistants).toHaveLength(2);
      expect(assistants[0].name).toBe("Bot One");
    });

    it("overwrites existing assistants", () => {
      useAppStore.setState({
        assistants: [
          {
            id: "old",
            name: "Old Bot",
            description: "",
            prompt: "",
            tools: [],
            knowledgebases: [],
            updatedAt: new Date(),
          },
        ],
      });
      useAppStore
        .getState()
        .loadAssistantRows([makeAssistantRow("a-new", "New Bot")]);
      expect(useAppStore.getState().assistants).toHaveLength(1);
      expect(useAppStore.getState().assistants[0].name).toBe("New Bot");
    });
  });
});

describe("EntitySlice — updateProjectDb / toggleProjectPinDb", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("updateProjectDb", () => {
    it("updates project fields in store after server action", async () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "Old Name",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(updateProjectAction).mockResolvedValueOnce({
        ...makeProjectRow("p1", "New Name"),
        description: "New desc",
        globalPrompt: null,
        updatedAt: NOW,
      });
      await useAppStore
        .getState()
        .updateProjectDb("p1", { name: "New Name", description: "New desc" });
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p1")?.name,
      ).toBe("New Name");
    });

    it("does not affect other projects", async () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
          {
            id: "p2",
            name: "P2",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(updateProjectAction).mockResolvedValueOnce({
        ...makeProjectRow("p1", "Updated P1"),
        updatedAt: NOW,
      });
      await useAppStore
        .getState()
        .updateProjectDb("p1", { name: "Updated P1" });
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p2")?.name,
      ).toBe("P2");
    });
  });

  describe("toggleProjectPinDb", () => {
    it("persists pin status to DB and updates store", async () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(togglePinProjectAction).mockResolvedValueOnce({
        ...makeProjectRow("p1"),
        isPinned: true,
        updatedAt: NOW,
      });
      await useAppStore.getState().toggleProjectPinDb("p1");
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p1")?.isPinned,
      ).toBe(true);
    });

    it("does not affect other projects", async () => {
      useAppStore.setState({
        projects: [
          {
            id: "p1",
            name: "P1",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
          {
            id: "p2",
            name: "P2",
            description: "",
            globalPrompt: "",
            isPinned: false,
            updatedAt: new Date(),
            knowledgebases: [],
          },
        ],
      });
      vi.mocked(togglePinProjectAction).mockResolvedValueOnce({
        ...makeProjectRow("p1"),
        isPinned: true,
        updatedAt: NOW,
      });
      await useAppStore.getState().toggleProjectPinDb("p1");
      expect(
        useAppStore.getState().projects.find((p) => p.id === "p2")?.isPinned,
      ).toBe(false);
    });
  });
});

describe("EntitySlice — updateAssistantDb", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("updates assistant fields in store after server action", async () => {
    useAppStore.setState({
      assistants: [
        {
          id: "a1",
          name: "Old Bot",
          description: "",
          prompt: "",
          tools: [],
          knowledgebases: [],
          updatedAt: new Date(),
        },
      ],
    });
    vi.mocked(updateAssistantAction).mockResolvedValueOnce({
      ...makeAssistantRow("a1", "Updated Bot"),
      description: "A desc",
      updatedAt: NOW,
    });
    await useAppStore
      .getState()
      .updateAssistantDb("a1", { name: "Updated Bot", description: "A desc" });
    expect(
      useAppStore.getState().assistants.find((a) => a.id === "a1")?.name,
    ).toBe("Updated Bot");
  });

  it("does not affect other assistants", async () => {
    useAppStore.setState({
      assistants: [
        {
          id: "a1",
          name: "Bot 1",
          description: "",
          prompt: "",
          tools: [],
          knowledgebases: [],
          updatedAt: new Date(),
        },
        {
          id: "a2",
          name: "Bot 2",
          description: "",
          prompt: "",
          tools: [],
          knowledgebases: [],
          updatedAt: new Date(),
        },
      ],
    });
    vi.mocked(updateAssistantAction).mockResolvedValueOnce({
      ...makeAssistantRow("a1", "Updated Bot 1"),
      updatedAt: NOW,
    });
    await useAppStore
      .getState()
      .updateAssistantDb("a1", { name: "Updated Bot 1" });
    expect(
      useAppStore.getState().assistants.find((a) => a.id === "a2")?.name,
    ).toBe("Bot 2");
  });
});

describe("EntitySlice — updatePromptDb", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("updates prompt fields in store after server action", async () => {
    useAppStore.setState({
      prompts: [
        {
          id: "pr1",
          title: "Old Title",
          shortcut: "old",
          content: "Old content",
          updatedAt: new Date(),
        },
      ],
    });
    vi.mocked(updatePromptAction).mockResolvedValueOnce({
      ...makePromptRow("pr1", "New Title"),
      shortcut: "new",
      content: "New content",
      updatedAt: NOW,
    });
    await useAppStore
      .getState()
      .updatePromptDb("pr1", {
        title: "New Title",
        shortcut: "new",
        content: "New content",
      });
    expect(
      useAppStore.getState().prompts.find((p) => p.id === "pr1")?.title,
    ).toBe("New Title");
  });

  it("does not affect other prompts", async () => {
    useAppStore.setState({
      prompts: [
        {
          id: "pr1",
          title: "Prompt 1",
          shortcut: "p1",
          content: "Content 1",
          updatedAt: new Date(),
        },
        {
          id: "pr2",
          title: "Prompt 2",
          shortcut: "p2",
          content: "Content 2",
          updatedAt: new Date(),
        },
      ],
    });
    vi.mocked(updatePromptAction).mockResolvedValueOnce({
      ...makePromptRow("pr1", "Updated Prompt 1"),
      shortcut: "p1",
      content: "Content 1",
      updatedAt: NOW,
    });
    await useAppStore
      .getState()
      .updatePromptDb("pr1", { title: "Updated Prompt 1" });
    expect(
      useAppStore.getState().prompts.find((p) => p.id === "pr2")?.title,
    ).toBe("Prompt 2");
  });
});

describe("EntitySlice — renameKnowledgebaseDb", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  const makeKbEntry = (id: string, name = "Test KB") => ({
    id,
    name,
    description: "",
    sizeBytes: 0,
    maxSizeBytes: 10000,
    documentCount: 0,
    updatedAt: new Date(),
  });

  it("updates knowledgebase name in store after server action", async () => {
    useAppStore.setState({
      knowledgebases: [makeKbEntry("kb1", "Old KB")],
    });
    vi.mocked(renameKnowledgebaseAction).mockResolvedValueOnce({
      id: "kb1",
      name: "Renamed KB",
      updatedAt: NOW,
    } as any);
    await useAppStore.getState().renameKnowledgebaseDb("kb1", "Renamed KB");
    expect(
      useAppStore.getState().knowledgebases.find((kb) => kb.id === "kb1")?.name,
    ).toBe("Renamed KB");
  });

  it("does not affect other knowledgebases", async () => {
    useAppStore.setState({
      knowledgebases: [makeKbEntry("kb1", "KB 1"), makeKbEntry("kb2", "KB 2")],
    });
    vi.mocked(renameKnowledgebaseAction).mockResolvedValueOnce({
      id: "kb1",
      name: "Renamed KB 1",
      updatedAt: NOW,
    } as any);
    await useAppStore.getState().renameKnowledgebaseDb("kb1", "Renamed KB 1");
    expect(
      useAppStore.getState().knowledgebases.find((kb) => kb.id === "kb2")?.name,
    ).toBe("KB 2");
  });
});
