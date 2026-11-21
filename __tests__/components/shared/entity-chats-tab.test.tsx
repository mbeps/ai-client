import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityChatsTab } from "@/components/shared/entity-chats-tab";
import type { Chat } from "@/types/chat/chat";

vi.mock("@/components/chat/chat-card", () => ({
  ChatCard: ({ chat }: { chat: Chat }) => (
    <div data-testid={`chat-card-${chat.id}`}>{chat.title}</div>
  ),
}));

const mockChats: Chat[] = [
  {
    id: "chat-1",
    title: "Architecture Review",
    messages: {},
    currentLeafId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("EntityChatsTab", () => {
  it("renders chat cards and updates search query", () => {
    const onSearchQueryChange = vi.fn();
    render(
      <EntityChatsTab
        searchQuery=""
        onSearchQueryChange={onSearchQueryChange}
        filteredChats={mockChats}
        emptyMessage="No chats yet."
      />,
    );

    expect(screen.getByTestId("chat-card-chat-1")).toHaveTextContent(
      "Architecture Review",
    );

    fireEvent.change(screen.getByPlaceholderText("Search chats..."), {
      target: { value: "arch" },
    });
    expect(onSearchQueryChange).toHaveBeenCalledWith("arch");
  });

  it("renders custom emptyMessage when filteredChats is empty and searchQuery is blank", () => {
    render(
      <EntityChatsTab
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        filteredChats={[]}
        emptyMessage="No chats with this agent yet."
      />,
    );

    expect(
      screen.getByText("No chats with this agent yet."),
    ).toBeInTheDocument();
  });

  it("renders search empty state when filteredChats is empty and searchQuery is non-empty", () => {
    render(
      <EntityChatsTab
        searchQuery="missing"
        onSearchQueryChange={vi.fn()}
        filteredChats={[]}
        emptyMessage="No chats with this agent yet."
      />,
    );

    expect(
      screen.getByText("No chats match your search."),
    ).toBeInTheDocument();
  });
});
