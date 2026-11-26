import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "@/types/chat/chat";

const {
  listChatsMock,
  getChatMock,
  notFoundMock,
  buildChatFromRowsMock,
  upsertChatMock,
  createNewChatMock,
  storeState,
} = vi.hoisted(() => ({
  listChatsMock: vi.fn(),
  getChatMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  buildChatFromRowsMock: vi.fn((val) => ({ id: "built", ...val })),
  upsertChatMock: vi.fn(),
  createNewChatMock: vi.fn(),
  storeState: {
    chats: {} as Record<string, Chat>,
  },
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/actions/chats/list-chats", () => ({
  listChats: listChatsMock,
}));

vi.mock("@/actions/chats/get-chat", () => ({
  getChat: getChatMock,
}));

vi.mock("@/lib/chat/message-tree-utils", () => ({
  buildChatFromRows: buildChatFromRowsMock,
}));

vi.mock("@/components/chat/chat-page-client", () => ({
  ChatPageClient: ({
    initialChat,
    initialMessage,
  }: {
    initialChat: { id: string };
    initialMessage?: string;
  }) => (
    <div data-testid="chat-page-client">
      {initialChat.id}:{initialMessage ?? ""}
    </div>
  ),
}));

vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: () => createNewChatMock,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: { chats: Record<string, Chat>; upsertChat: typeof upsertChatMock }) => unknown) =>
    selector({
      chats: storeState.chats,
      upsertChat: upsertChatMock,
    }),
}));

vi.mock("@/components/chat/chat-card", () => ({
  ChatCard: ({ chat }: { chat: Chat }) => <div data-testid={`chat-card-${chat.id}`}>{chat.title}</div>,
}));

vi.mock("@/components/shared/resource-list-page", () => ({
  ResourceListPage: ({
    items,
    renderCard,
    action,
    filterFn,
    customFilterFn,
    extraFilters,
  }: {
    items: Chat[];
    renderCard: (item: Chat) => React.ReactNode;
    action: React.ReactNode;
    filterFn: (item: Chat, q: string) => boolean;
    customFilterFn: (item: Chat) => boolean;
    extraFilters: React.ReactNode;
  }) => (
    <div data-testid="resource-list-page">
      {action}
      {extraFilters}
      <div data-testid="filtered-items">
        {items
          .filter((item) => customFilterFn(item) && filterFn(item, ""))
          .map((item) => (
            <div key={item.id}>{renderCard(item)}</div>
          ))}
      </div>
      <div data-testid="search-alpha">
        {items.filter((item) => filterFn(item, "alpha")).length}
      </div>
    </div>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        data-testid="chat-filter-select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="all">All Chats</option>
        <option value="project">In Projects</option>
        <option value="agent">With Agents</option>
        <option value="none">Standalone</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ChatsPage from "@/app/(main)/chats/page";
import ChatPage from "@/app/(main)/chats/[id]/page";
import { ChatsClient } from "@/app/(main)/chats/_components/chats-client";

describe("Chats pages and client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.chats = {};
  });

  it("renders ChatsPage with mapped rows when listChats succeeds", async () => {
    listChatsMock.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "c1",
          title: "Chat 1",
          projectId: "p1",
          agentId: "a1",
          knowledgebaseId: "kb1",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          currentLeafId: "m1",
        },
        {
          id: "c2",
          title: "Chat 2",
          projectId: null,
          agentId: null,
          knowledgebaseId: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          currentLeafId: null,
        },
      ],
    });

    const el = await ChatsPage();
    render(el);

    expect(upsertChatMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("resource-list-page")).toBeInTheDocument();
  });

  it("renders ChatsPage with empty list when listChats fails", async () => {
    listChatsMock.mockResolvedValue({ ok: false, error: new Error("fail") });
    const el = await ChatsPage();
    render(el);
    expect(upsertChatMock).not.toHaveBeenCalled();
  });

  it("renders ChatPage when getChat succeeds and calls notFound when it fails", async () => {
    getChatMock.mockResolvedValueOnce({ ok: true, value: { id: "c1" } });
    const el = await ChatPage({
      params: Promise.resolve({ id: "c1" }),
      searchParams: Promise.resolve({ msg: "hi" }),
    });
    render(el);
    expect(screen.getByTestId("chat-page-client")).toHaveTextContent("c1:hi");

    getChatMock.mockResolvedValueOnce({ ok: false, error: new Error("missing") });
    await expect(
      ChatPage({
        params: Promise.resolve({ id: "c404" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("filters chats by project, agent, assistantId, standalone, and search query", () => {
    const now = new Date();
    const chats: Record<string, Chat> = {
      c1: { id: "c1", title: "Alpha Project", projectId: "p1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
      c2: { id: "c2", title: "Beta Agent", agentId: "a1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
      c3: { id: "c3", title: "Gamma Assistant", assistantId: "as1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
      c4: { id: "c4", title: "Delta Standalone", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
    };
    storeState.chats = chats;

    render(<ChatsClient initialChats={Object.values(chats)} />);

    expect(screen.getByTestId("search-alpha")).toHaveTextContent("1");
    expect(screen.getByTestId("chat-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("chat-card-c4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /New Chat/i }));
    expect(createNewChatMock).toHaveBeenCalled();

    const select = screen.getByTestId("chat-filter-select");
    fireEvent.change(select, { target: { value: "project" } });
    expect(screen.getByTestId("chat-card-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-card-c2")).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: "agent" } });
    expect(screen.getByTestId("chat-card-c2")).toBeInTheDocument();
    expect(screen.getByTestId("chat-card-c3")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-card-c1")).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: "none" } });
    expect(screen.getByTestId("chat-card-c4")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-card-c1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-card-c2")).not.toBeInTheDocument();
  });
});
