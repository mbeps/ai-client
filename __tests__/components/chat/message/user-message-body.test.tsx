import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserMessageBody } from "@/components/chat/message/user-message-body";

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: (props: { initialModelId?: string }) => (
    <div data-testid="chat-input" data-model={props.initialModelId ?? "none"} />
  ),
}));

describe("UserMessageBody", () => {
  it("renders ChatInput when isEditing is true with null initialModelId", () => {
    render(
      <UserMessageBody
        hasAttachments={false}
        attachments={[]}
        selectedPrompts={[]}
        selectedSkillIds={[]}
        skills={[]}
        selectedKbIds={[]}
        knowledgebases={[]}
        isEditing={true}
        displayContent="hi"
        editProps={{
          initialValue: "hi",
          initialModelId: null,
          initialAttachments: [],
          onSend: vi.fn(),
          onCancel: vi.fn(),
        }}
      />,
    );
    expect(screen.getByTestId("chat-input").getAttribute("data-model")).toBe("none");
  });
});
