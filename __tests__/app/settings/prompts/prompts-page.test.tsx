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
    projectIds: ["proj-1"],
    assistantIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "p-1",
    userId: "user-1",
    title: "Code Review",
    shortcut: "review",
    content: "Review the code",
    projectIds: [],
    assistantIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "p-2",
    userId: "user-1",
    title: "Refactor Helper",
    shortcut: "refactor",
    content: "Refactor this function",
    projectIds: [],
    agentIds: ["asst-1"],
    assistantIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"),
  },
  {
    id: "p-4",
    userId: "user-1",
    title: "Debug Helper",
    shortcut: "debug",
    content: "Debug this issue",
    projectIds: [],
    assistantIds: undefined as unknown as string[],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-15"),
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      prompts: mockPrompts,
      projects: [{ id: "proj-1", name: "Alpha Project" }],
      agents: [{ id: "asst-1", name: "Beta Assistant" }],
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
      "Debug Helper",
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

    const assistantsFilterBtn = screen.getByRole("button", { name: "Agents" });
    await user.click(assistantsFilterBtn);

    expect(screen.getByText("Refactor Helper")).toBeInTheDocument();
    expect(screen.queryByText("Code Review")).not.toBeInTheDocument();

    const allFilterBtn = screen.getByRole("button", { name: "All" });
    await user.click(allFilterBtn);

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Refactor Helper")).toBeInTheDocument();
    expect(screen.getByText("Summarize Code")).toBeInTheDocument();
  });

  it("filters prompts by search query across title, shortcut, and content", async () => {
    const user = userEvent.setup();
    render(<PromptsPage />);

    const searchInput = screen.getByPlaceholderText("Search prompts...");

    await user.type(searchInput, "Code Review");
    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.queryByText("Refactor Helper")).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "refactor");
    expect(screen.getByText("Refactor Helper")).toBeInTheDocument();
    expect(screen.queryByText("Code Review")).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "Summarize the given");
    expect(screen.getByText("Summarize Code")).toBeInTheDocument();
    expect(screen.queryByText("Code Review")).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "nonexistent-xyz");
    expect(screen.queryByText("Code Review")).not.toBeInTheDocument();
  });
});

