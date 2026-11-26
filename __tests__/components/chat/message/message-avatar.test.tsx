import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MessageAvatar } from "@/components/chat/message/message-avatar";

describe("MessageAvatar", () => {
  it("handles null image and null name for user avatar", () => {
    const { container } = render(
      <MessageAvatar isUser={true} image={null} name={null} />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
