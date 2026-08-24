import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useResourceHydration,
  hydratedResources,
} from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store";

// Safety-net mocks
vi.mock("@/lib/env", () => ({
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

// Mock all server actions that entity slice uses
vi.mock("@/lib/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/list-prompts", () => ({
  listPrompts: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/list-public-mcp-servers", () => ({
  listPublicMcpServers: vi.fn(),
}));
vi.mock("@/lib/actions/transform-agents/list-transform-agents", () => ({
  listTransformAgents: vi.fn(),
}));
vi.mock("@/lib/actions/user-settings/get-user-settings", () => ({
  getUserSettings: vi.fn(),
}));
vi.mock("@/lib/actions/mcp/discover-all-prompts", () => ({
  discoverAllPrompts: vi.fn(),
}));

// Chat slice stubs
vi.mock("@/lib/actions/chats/create-chat", () => ({
  createChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/delete-chat", () => ({
  deleteChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/rename-chat", () => ({
  renameChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/move-chat", () => ({
  moveChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-chat-knowledgebase", () => ({
  updateChatKnowledgebase: vi.fn(),
}));

import { listProjects } from "@/lib/actions/projects/list-projects";

const RESET_STATE = {
  chats: {},
  projects: [],
  assistants: [],
  prompts: [],
  userSettings: null,
  mcpServers: [],
  publicMcpServers: [],
  transformAgents: [],
  mcpPrompts: [],
};

beforeEach(() => {
  useAppStore.setState(RESET_STATE);
  hydratedResources.clear();
  vi.clearAllMocks();
});

describe("useResourceHydration", () => {
  it("T5.6/T5.7: calls loadProjects when projects is empty", async () => {
    vi.mocked(listProjects).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useResourceHydration(["projects"]));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(vi.mocked(listProjects)).toHaveBeenCalledTimes(1);
  });

  it("T5.7: does NOT call loadProjects again when already hydrated (empty result)", async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    // First mount - loads (returns empty)
    const { unmount } = renderHook(() => useResourceHydration(["projects"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(vi.mocked(listProjects)).toHaveBeenCalledTimes(1);
    unmount();

    // Second mount - should NOT load again (already hydrated)
    renderHook(() => useResourceHydration(["projects"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(vi.mocked(listProjects)).toHaveBeenCalledTimes(1); // still 1, not 2
  });

  it("T5.4 gap: re-fetches after hydratedResources.clear() (simulates sign-out + re-login)", async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    // First mount — loads and hydrates
    const { unmount } = renderHook(() => useResourceHydration(["projects"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(vi.mocked(listProjects)).toHaveBeenCalledTimes(1);
    unmount();

    // Simulate signOut clearing the set
    hydratedResources.clear();

    // Second mount — should re-fetch because hydratedResources was cleared
    renderHook(() => useResourceHydration(["projects"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(vi.mocked(listProjects)).toHaveBeenCalledTimes(2);
  });
});
