import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    projectId: "proj-1",
    assistantId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "p-1",
    userId: "user-1",
    title: "Code Review",
    shortcut: "review",
    content: "Review the code",
    projectId: null,
    assistantId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "p-2",
    userId: "user-1",
    title: "Refactor Helper",
    shortcut: "refactor",
    content: "Refactor this function",
    projectId: null,
    assistantId: "asst-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"),
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      prompts: mockPrompts,
      projects: [{ id: "proj-1", name: "Alpha Project" }],
      assistants: [{ id: "asst-1", name: "Beta Assistant" }],
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

  it("filters prompts when scope filter buttons are clicked", async () => {
    const user = userEvent.setup();
    render(<PromptsPage />);

    const globalFilterBtn = screen.getByRole("button", { name: "Global" });
    await user.click(globalFilterBtn);

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.queryByText("Refactor Helper")).not.toBeInTheDocument();
    expect(screen.queryByText("Summarize Code")).not.toBeInTheDocument();

    const projectsFilterBtn = screen.getByRole("button", { name: "Projects" });
    await user.click(projectsFilterBtn);

    expect(screen.getByText("Summarize Code")).toBeInTheDocument();
    expect(screen.queryByText("Code Review")).not.toBeInTheDocument();

    const assistantsFilterBtn = screen.getByRole("button", { name: "Assistants" });
    await user.click(assistantsFilterBtn);

    expect(screen.getByText("Refactor Helper")).toBeInTheDocument();
    expect(screen.queryByText("Code Review")).not.toBeInTheDocument();

    const allFilterBtn = screen.getByRole("button", { name: "All" });
    await user.click(allFilterBtn);

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Refactor Helper")).toBeInTheDocument();
    expect(screen.getByText("Summarize Code")).toBeInTheDocument();
  });
});

