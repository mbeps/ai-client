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

vi.mock("@/lib/store", () => ({
  useAppStore: () => vi.fn(),
}));

import { PromptOptions } from "@/components/prompt/prompt-options";
import { ROUTES } from "@/config/routes";
import type { Prompt } from "@/types/prompt/prompt";

describe("PromptOptions Link refactoring", () => {
  it("renders Edit Content link with ROUTES.SETTINGS.PROMPTS.detail", async () => {
    const user = userEvent.setup();
    const prompt: Prompt = {
      id: "prompt-456",
      title: "Summarize Text",
      shortcut: "sum",
      content: "Summarize this",
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<PromptOptions prompt={prompt} />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    const editItem = screen.getByRole("menuitem", { name: /edit content/i });
    expect(editItem).toBeInTheDocument();
    expect(editItem.tagName.toLowerCase()).toBe("a");
    expect(editItem).toHaveAttribute("href", ROUTES.SETTINGS.PROMPTS.detail("prompt-456"));
  });
});
