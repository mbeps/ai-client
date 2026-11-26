import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageThread } from "@/components/chat/message-thread";
import type { Chat, Message } from "@/types/chat/chat";

vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: () => ({ knowledgebases: [] }),
}));

vi.mock("@/components/chat/message-bubble", () => ({
  MessageBubble: ({
    message,
    siblings,
    onNavigateBranch,
  }: {
    message: Message;
    siblings: Message[];
    onNavigateBranch: (id: string) => void;
  }) => (
    <div data-testid={`bubble-${message.id}`}>
      <span>{message.content}</span>
      <span>siblings:{siblings.length}</span>
      <button type="button" onClick={() => onNavigateBranch("sib-next")}>
        nav-{message.id}
      </button>
    </div>
  ),
}));

describe("MessageThread", () => {
  const baseChat = {
    id: "chat-1",
    title: "Chat",
    userId: "u1",
    assistantId: "asst-1",
    messages: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Chat;

  it("renders empty state when thread is empty", () => {
    render(
      <MessageThread
        thread={[]}
        chat={baseChat}
        isLoading={false}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onNavigateBranch={vi.fn()}
      />,
    );

    expect(screen.getByText("How can I help you today?")).toBeInTheDocument();
  });

  it("renders root and child messages with siblings and forwards onNavigateBranch", () => {
    const onNavigateBranch = vi.fn();
    const root1 = {
      id: "m1",
      role: "user",
      content: "Root 1",
      parentId: null,
      childrenIds: ["m2"],
    } as unknown as Message;
    const root2 = {
      id: "m1b",
      role: "user",
      content: "Root 2",
      parentId: null,
      childrenIds: [],
    } as unknown as Message;
    const child = {
      id: "m2",
      role: "assistant",
      content: "Child 1",
      parentId: "m1",
      childrenIds: [],
    } as unknown as Message;

    const chatWithMessages = {
      ...baseChat,
      messages: { m1: root1, m1b: root2, m2: child },
    } as unknown as Chat;

    render(
      <MessageThread
        thread={[root1, child]}
        chat={chatWithMessages}
        isLoading={false}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onNavigateBranch={onNavigateBranch}
      />,
    );

    expect(screen.getByTestId("bubble-m1")).toHaveTextContent("siblings:2");
    expect(screen.getByTestId("bubble-m2")).toHaveTextContent("siblings:1");

    fireEvent.click(screen.getByRole("button", { name: "nav-m1" }));
    expect(onNavigateBranch).toHaveBeenCalledWith("sib-next");
  });
});
