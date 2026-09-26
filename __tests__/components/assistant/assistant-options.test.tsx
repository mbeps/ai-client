import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  if (typeof window !== "undefined") {
    if (!window.HTMLElement.prototype.setPointerCapture) {
      window.HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!window.HTMLElement.prototype.releasePointerCapture) {
      window.HTMLElement.prototype.releasePointerCapture = () => {};
    }
    if (!window.HTMLElement.prototype.hasPointerCapture) {
      window.HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  }
});

vi.mock("@/hooks/use-entity-options", () => ({
  useEntityOptions: () => ({
    isMobile: false,
    showRename: false,
    setShowRename: vi.fn(),
    showDelete: false,
    setShowDelete: vi.fn(),
    isDeleting: false,
    handleRename: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: () => vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: () => vi.fn(),
}));

import { AssistantOptions } from "@/components/assistant/assistant-options";
import { ROUTES } from "@/config/routes";
import type { Assistant } from "@/types/assistant/assistant";

describe("AssistantOptions Link refactoring", () => {
  it("renders Manage link with ROUTES.ASSISTANTS.detail", async () => {
    const user = userEvent.setup();
    const assistant: Assistant = {
      id: "asst-123",
      name: "Research Assistant",
      systemPrompt: "Help with research",
      modelId: "gpt-4o",
      tools: [],
      knowledgeBaseIds: [],
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<AssistantOptions assistant={assistant} />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    const manageItem = screen.getByRole("menuitem", { name: /manage/i });
    expect(manageItem).toBeInTheDocument();
    expect(manageItem.tagName.toLowerCase()).toBe("a");
    expect(manageItem).toHaveAttribute("href", ROUTES.ASSISTANTS.detail("asst-123"));
  });
});
