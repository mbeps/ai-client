import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PromptsPage from "@/app/settings/prompts/page";
import type { Prompt } from "@/types/prompt/prompt";

const mockLoadPrompts = vi.fn();

const mockPrompts: Prompt[] = [
  {
    id: "p-3",
    userId: "user-1",
    title: "Summarize Code",
    shortcut: "summarize",
    content: "Summarize the given code",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-01"), // Most recently updated
  },
  {
    id: "p-1",
    userId: "user-1",
    title: "Code Review",
    shortcut: "review",
    content: "Review the code",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"), // Oldest
  },
  {
    id: "p-2",
    userId: "user-1",
    title: "Refactor Helper",
    shortcut: "refactor",
    content: "Refactor this function",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"), // Middle
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      prompts: mockPrompts,
      loadPrompts: mockLoadPrompts,
      loadError: null,
    }),
}));

describe("PromptsPage", () => {
  it("renders prompts in alphabetical order by title regardless of updatedAt recency", () => {
    const { container } = render(<PromptsPage />);

    expect(screen.getByText("Prompts")).toBeInTheDocument();
    expect(mockLoadPrompts).toHaveBeenCalled();

    const promptHeadings = container.querySelectorAll("h3");
    const titles = Array.from(promptHeadings).map((h) => h.textContent);

    expect(titles).toEqual([
      "Code Review",
      "Refactor Helper",
      "Summarize Code",
    ]);
  });
});

