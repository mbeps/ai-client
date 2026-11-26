import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatCard } from "@/components/chat/chat-card";
import type { Chat } from "@/types/chat/chat";

vi.mock("@/components/chat/chat-options", () => ({
  ChatOptions: () => <div data-testid="chat-options" />,
}));

describe("ChatCard", () => {
  it("renders valid Date object, invalid date string, and missing createdAt", () => {
    const baseChat = {
      id: "c1",
      title: "My Chat",
      userId: "u1",
      projectId: null,
      updatedAt: new Date("2025-01-01"),
    } as Chat;

    const { rerender } = render(
      <ChatCard chat={{ ...baseChat, createdAt: new Date("2025-02-15T12:00:00Z") }} />,
    );
    expect(screen.getByText("My Chat")).toBeInTheDocument();
    expect(screen.getByText("Feb 15, 2025")).toBeInTheDocument();

    rerender(<ChatCard chat={{ ...baseChat, createdAt: "not-a-date" as unknown as Date }} />);
    expect(screen.queryByText("Feb 15, 2025")).not.toBeInTheDocument();

    rerender(<ChatCard chat={{ ...baseChat, createdAt: undefined as unknown as Date }} />);
    expect(screen.getByText("My Chat")).toBeInTheDocument();

    const badDate = {
      getTime: () => {
        throw new Error("bad date");
      },
    } as unknown as Date;
    rerender(<ChatCard chat={{ ...baseChat, createdAt: badDate }} />);
    expect(screen.getByText("My Chat")).toBeInTheDocument();
  });
});
