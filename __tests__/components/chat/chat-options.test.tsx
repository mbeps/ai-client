import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatOptions } from "@/components/chat/chat-options";
import type { Chat } from "@/types/chat/chat";

const mockRenameChatDb = vi.fn();
const mockDeleteChatDb = vi.fn();
const mockHandleRename = vi.fn();
const mockHandleDelete = vi.fn();
const mockSetShowRename = vi.fn();
const mockSetShowDelete = vi.fn();

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      renameChatDb: mockRenameChatDb,
      deleteChatDb: mockDeleteChatDb,
    }),
}));

vi.mock("@/hooks/use-entity-options", () => ({
  useEntityOptions: (opts: {
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
  }) => {
    // Exercise callbacks
    opts.onRename("chat-1", "New Title");
    opts.onDelete("chat-1");
    return {
      isMobile: false,
      showRename: false,
      setShowRename: mockSetShowRename,
      showDelete: false,
      setShowDelete: mockSetShowDelete,
      isDeleting: false,
      handleRename: mockHandleRename,
      handleDelete: mockHandleDelete,
    };
  },
}));

vi.mock("@/components/shared/base-entity-options", () => ({
  BaseEntityOptions: ({
    items,
  }: {
    items: Array<{ label: string; onClick: () => void }>;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/shared/move-chat-dialog", () => ({
  MoveChatDialog: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="move-dialog">
        <button type="button" onClick={onClose}>
          Close Move
        </button>
      </div>
    ) : null,
}));

const sampleChat: Chat = {
  id: "chat-1",
  title: "Test Chat",
  userId: "user-1",
  projectId: "proj-1",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
} as Chat;

describe("ChatOptions", () => {
  it("renders actions and triggers rename, move, and delete handlers", () => {
    render(<ChatOptions chat={sampleChat} />);

    expect(mockRenameChatDb).toHaveBeenCalledWith("chat-1", "New Title");
    expect(mockDeleteChatDb).toHaveBeenCalledWith("chat-1");

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(mockSetShowRename).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Delete Chat" }));
    expect(mockSetShowDelete).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Move Chat" }));
    expect(screen.getByTestId("move-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close Move" }));
    expect(screen.queryByTestId("move-dialog")).not.toBeInTheDocument();
  });
});
