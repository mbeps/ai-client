import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCreateChat } from "@/hooks/chat/use-create-chat";

// ─── Hoisted mock variables (must run before vi.mock factories) ────────────
const mockPush = vi.hoisted(() => vi.fn());

// ─── Safety-net mocks: prevent env/db/auth from loading ───────────────────
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

// ─── Mocks ──────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: mockPush }),
}));

// Entity slice server actions (consumed transitively through useAppStore)
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
vi.mock("@/lib/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/list-prompts", () => ({ listPrompts: vi.fn() }));
vi.mock("@/lib/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));

// ─── createChatDb mock via the store action ────────────────────────────────
import { useAppStore } from "@/lib/store";

const NOW = new Date().toISOString();

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("useCreateChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a chat and navigates to the standalone chat URL", async () => {
    vi.spyOn(useAppStore.getState(), "createChatDb").mockResolvedValueOnce(
      "chat-abc",
    );

    const { result } = renderHook(() => useCreateChat());

    let id: string | undefined;
    await act(async () => {
      id = await result.current("New Chat");
    });

    expect(id).toBe("chat-abc");
    expect(mockPush).toHaveBeenCalledWith("/chats/chat-abc");
  });

  it("navigates to the project-scoped chat URL when projectId is provided", async () => {
    vi.spyOn(useAppStore.getState(), "createChatDb").mockResolvedValueOnce(
      "chat-def",
    );

    const { result } = renderHook(() => useCreateChat());

    await act(async () => {
      await result.current("New Chat", "proj-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1/chat-def");
  });

  it("navigates to the assistant-scoped chat URL when assistantId is provided", async () => {
    vi.spyOn(useAppStore.getState(), "createChatDb").mockResolvedValueOnce(
      "chat-ghi",
    );

    const { result } = renderHook(() => useCreateChat());

    await act(async () => {
      await result.current("New Chat", undefined, "asst-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/assistants/asst-1/chat-ghi");
  });

  it("uses 'New Chat' as the default title", async () => {
    const spy = vi
      .spyOn(useAppStore.getState(), "createChatDb")
      .mockResolvedValueOnce("chat-xyz");

    const { result } = renderHook(() => useCreateChat());

    await act(async () => {
      await result.current();
    });

    expect(spy).toHaveBeenCalledWith("New Chat", undefined, undefined);
  });

  it("re-throws when createChatDb fails", async () => {
    vi.spyOn(useAppStore.getState(), "createChatDb").mockRejectedValueOnce(
      new Error("DB error"),
    );

    const { result } = renderHook(() => useCreateChat());

    await expect(
      act(async () => {
        await result.current("New Chat");
      }),
    ).rejects.toThrow("DB error");
  });
});
