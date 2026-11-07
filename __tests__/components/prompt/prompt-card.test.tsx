import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeletePrompt = vi.fn();
vi.mock("@/actions/prompts/delete-prompt", () => ({
  deletePrompt: (id: string) => mockDeletePrompt(id),
}));

import { PromptCard } from "@/components/prompt/prompt-card";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Prompt } from "@/types/prompt/prompt";

describe("PromptCard", () => {
  const mockProjects = [
    {
      id: "proj-1",
      name: "Alpha Project",
    },
  ];

  const mockAssistants = [
    {
      id: "asst-1",
      name: "Beta Assistant",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      projects: mockProjects as any,
      assistants: mockAssistants as any,
      loadPrompts: vi.fn(),
    });
  });

  const basePrompt: Prompt = {
    id: "p1",
    userId: "u1",
    title: "Global Prompt",
    shortcut: "glob",
    content: "Global prompt content",
    projectId: null,
    assistantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renders global badge when prompt has no projectId or assistantId", () => {
    render(<PromptCard prompt={basePrompt} />);

    expect(screen.getByText("Global Prompt")).toBeInTheDocument();
    expect(screen.getByText("/glob")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("renders project badge when prompt has projectId", () => {
    const projectPrompt: Prompt = {
      ...basePrompt,
      id: "p2",
      title: "Project Prompt",
      shortcut: "/proj",
      projectId: "proj-1",
    };

    render(<PromptCard prompt={projectPrompt} />);

    expect(screen.getByText("Project Prompt")).toBeInTheDocument();
    expect(screen.getByText("/proj")).toBeInTheDocument();
    expect(screen.getByText("Project: Alpha Project")).toBeInTheDocument();
  });

  it("renders assistant badge when prompt has assistantId", () => {
    const assistantPrompt: Prompt = {
      ...basePrompt,
      id: "p3",
      title: "Assistant Prompt",
      assistantId: "asst-1",
    };

    render(<PromptCard prompt={assistantPrompt} />);

    expect(screen.getByText("Assistant Prompt")).toBeInTheDocument();
    expect(screen.getByText("Assistant: Beta Assistant")).toBeInTheDocument();
  });

  it("opens delete dialog and deletes prompt", async () => {
    const user = userEvent.setup();
    mockDeletePrompt.mockResolvedValueOnce({ ok: true });

    render(<PromptCard prompt={basePrompt} />);

    const deleteBtn = screen.getByLabelText("Delete prompt");
    await user.click(deleteBtn);

    expect(screen.getByText('Are you sure you want to delete "Global Prompt"? This action cannot be undone.')).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeletePrompt).toHaveBeenCalledWith("p1");
    });
  });
});
