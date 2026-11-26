import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageHeader } from "@/components/chat/message/message-bubble-header";

describe("MessageHeader", () => {
  it("renders custom assistantName when isUser is false", () => {
    render(
      <MessageHeader
        isUser={false}
        assistantName="CustomBot"
      />,
    );
    expect(screen.getByText("CustomBot")).toBeTruthy();
  });

  it("renders default assistant name when assistantName is omitted", () => {
    render(<MessageHeader isUser={false} />);
    expect(screen.getByTestId("message-header").textContent).toBeTruthy();
  });
});
