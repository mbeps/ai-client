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

import { AssistantPromptTab } from "@/components/assistant/assistant-prompt-tab";
import { useAppStore } from "@/lib/store/use-app-store";

describe("AssistantPromptTab", () => {
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
      id: "p-asst",
      userId: "u1",
      title: "Assistant Prompt",
      shortcut: "asst",
      content: "Assistant content",
      projectIds: [],
      assistantIds: ["asst-1"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    useAppStore.setState({
      prompts: mockPrompts,
      assistants: [{ id: "asst-1", name: "Assistant One" }] as any,
      projects: [],
    });
  });

  it("renders assistant system prompt editor and assistant shortcuts", () => {
    render(
      <AssistantPromptTab
        assistantId="asst-1"
        prompt="Custom assistant instructions"
        onPromptChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Custom assistant instructions")).toBeInTheDocument();
    expect(screen.getByText("Assistant Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Assistant Prompt")).toBeInTheDocument();
  });

  it("allows switching prompt modes and displays PromptPicker when mode is specific", async () => {
    const user = userEvent.setup();
    const onPromptModeChange = vi.fn();
    const onTogglePromptId = vi.fn();

    const { rerender } = render(
      <AssistantPromptTab
        assistantId="asst-1"
        prompt=""
        onPromptChange={vi.fn()}
        promptMode="all"
        onPromptModeChange={onPromptModeChange}
        onSave={vi.fn()}
      />,
    );

    const specificOption = screen.getByText("Specific Global Prompts");
    await user.click(specificOption);
    expect(onPromptModeChange).toHaveBeenCalledWith("specific");

    rerender(
      <AssistantPromptTab
        assistantId="asst-1"
        prompt=""
        onPromptChange={vi.fn()}
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
      <AssistantPromptTab
        assistantId="asst-1"
        prompt=""
        onPromptChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
