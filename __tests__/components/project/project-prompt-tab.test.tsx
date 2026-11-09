import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="markdown-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { ProjectPromptTab } from "@/components/project/project-prompt-tab";
import { useAppStore } from "@/lib/store/use-app-store";

describe("ProjectPromptTab", () => {
  const mockPrompts = [
    {
      id: "p-global",
      userId: "u1",
      title: "Global Prompt",
      shortcut: "glob",
      content: "Global content",
      projectIds: [],
      assistantIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "p-proj",
      userId: "u1",
      title: "Project Prompt",
      shortcut: "proj",
      content: "Project content",
      projectIds: ["proj-1"],
      assistantIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    useAppStore.setState({
      prompts: mockPrompts,
      projects: [{ id: "proj-1", name: "Project One" }] as any,
      assistants: [],
    });
  });

  it("renders global system prompt editor and project shortcuts", () => {
    render(
      <ProjectPromptTab
        projectId="proj-1"
        globalPrompt="Custom project instructions"
        onGlobalPromptChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Custom project instructions")).toBeInTheDocument();
    expect(screen.getByText("Project Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Project Prompt")).toBeInTheDocument();
  });

  it("allows switching prompt modes and displays PromptPicker when mode is specific", async () => {
    const user = userEvent.setup();
    const onPromptModeChange = vi.fn();
    const onTogglePromptId = vi.fn();

    const { rerender } = render(
      <ProjectPromptTab
        projectId="proj-1"
        globalPrompt=""
        onGlobalPromptChange={vi.fn()}
        promptMode="all"
        onPromptModeChange={onPromptModeChange}
        onSave={vi.fn()}
      />,
    );

    const specificOption = screen.getByText("Specific Global Prompts");
    await user.click(specificOption);
    expect(onPromptModeChange).toHaveBeenCalledWith("specific");

    rerender(
      <ProjectPromptTab
        projectId="proj-1"
        globalPrompt=""
        onGlobalPromptChange={vi.fn()}
        promptMode="specific"
        onPromptModeChange={onPromptModeChange}
        selectedPromptIds={new Set(["p-global"])}
        onTogglePromptId={onTogglePromptId}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Select Allowed Global Prompts")).toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ProjectPromptTab
        projectId="proj-1"
        globalPrompt=""
        onGlobalPromptChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
