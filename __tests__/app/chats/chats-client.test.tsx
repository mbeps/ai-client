import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatsClient } from "@/app/(main)/chats/_components/chats-client";
import { ROUTES } from "@/config/routes";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";
import type { Chat } from "@/types/chat/chat";

const mockUpsertChat = vi.fn();
let mockStoreChats: Record<string, Chat> = {};

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (
    selector: (s: {
      chats: Record<string, Chat>;
      upsertChat: typeof mockUpsertChat;
    }) => unknown,
  ) => selector({ chats: mockStoreChats, upsertChat: mockUpsertChat }),
}));

vi.mock("@/components/chat/chat-card", () => ({
  ChatCard: ({ chat }: { chat: Chat }) => (
    <div data-testid={`chat-card-${chat.id}`}>{chat.title}</div>
  ),
}));

const sampleChats: Chat[] = [
  {
    id: "c-standalone",
    title: "Standalone Chat",
    updatedAt: new Date("2026-11-26T10:00:00Z"),
    messages: {},
    currentLeafId: null,
  },
  {
    id: "c-project",
    title: "Project Chat",
    projectId: "proj-1",
    updatedAt: new Date("2026-11-26T10:00:00Z"),
    messages: {},
    currentLeafId: null,
  },
  {
    id: "c-agent",
    title: "Agent Chat",
    agentId: "agent-1",
    updatedAt: new Date("2026-11-26T10:00:00Z"),
    messages: {},
    currentLeafId: null,
  },
  {
    id: "c-workflow",
    title: "Builder: My Workflow",
    workflowId: "wf-1",
    updatedAt: new Date("2026-11-26T10:00:00Z"),
    messages: {},
    currentLeafId: null,
  },
];

describe("ChatsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreChats = Object.fromEntries(sampleChats.map((c) => [c.id, c]));
  });

  it("filters workflow chats with 'In Workflows' and excludes them from 'Standalone'", async () => {
    const user = userEvent.setup();
    render(<ChatsClient initialChats={sampleChats} />);

    expect(screen.getByTestId("chat-card-c-workflow")).toBeInTheDocument();
    expect(screen.getByTestId("chat-card-c-standalone")).toBeInTheDocument();

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "In Workflows" }));

    expect(screen.getByTestId("chat-card-c-workflow")).toBeInTheDocument();
    expect(
      screen.queryByTestId("chat-card-c-standalone"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-card-c-project")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-card-c-agent")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Standalone" }));

    expect(screen.getByTestId("chat-card-c-standalone")).toBeInTheDocument();
    expect(
      screen.queryByTestId("chat-card-c-workflow"),
    ).not.toBeInTheDocument();
  });

  it("links 'New Chat' button to '/' and resets draft chat state on click", async () => {
    const user = userEvent.setup();
    useChatToolsStore.getState().clearAll();
    useChatToolsStore
      .getState()
      .setChatTools(NEW_CHAT_TOOLS_KEY, ["srv:tool:stale"]);

    render(<ChatsClient initialChats={sampleChats} />);

    const newChatLink = screen.getByRole("link", { name: /new chat/i });
    expect(newChatLink).toHaveAttribute("href", ROUTES.HOME.path);

    const prevNonce = useChatToolsStore.getState().draftResetNonce;
    await user.click(newChatLink);

    expect(
      useChatToolsStore.getState().toolsByChat[NEW_CHAT_TOOLS_KEY],
    ).toBeUndefined();
    expect(useChatToolsStore.getState().draftResetNonce).toBe(prevNonce + 1);
  });
});
