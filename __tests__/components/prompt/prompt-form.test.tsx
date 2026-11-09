import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

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
      aria-label="prompt-content-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { PromptForm } from "@/components/prompt/prompt-form";
import { useAppStore } from "@/lib/store/use-app-store";

describe("PromptForm", () => {
  const mockProjects = [
    {
      id: "proj-1",
      userId: "u1",
      name: "Alpha Project",
      description: "Description",
      globalPrompt: "",
      tools: [],
      skillMode: "dynamic" as const,
      skillIds: [],
      promptMode: "all" as const,
      promptIds: [],
      knowledgebaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockAssistants = [
    {
      id: "asst-1",
      userId: "u1",
      name: "Beta Assistant",
      description: "Description",
      prompt: "",
      tools: [],
      skillMode: "dynamic" as const,
      skillIds: [],
      promptMode: "all" as const,
      promptIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    useAppStore.setState({
      projects: mockProjects,
      assistants: mockAssistants,
    });
  });

  it("renders with default values", () => {
    render(
      <PromptForm
        defaultValues={{
          title: "My Prompt",
          shortcut: "test-shortcut",
          content: "Prompt instructions",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("My Prompt")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test-shortcut")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Prompt instructions")).toBeInTheDocument();
  });

  it("calls onSubmit when submitted with valid global values", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <PromptForm
        defaultValues={{
          title: "Code Review",
          shortcut: "review",
          content: "Review this code",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitMock.mock.calls[0][0]).toEqual({
      title: "Code Review",
      shortcut: "review",
      content: "Review this code",
      projectIds: [],
      assistantIds: [],
    });
  });

  it("renders with locked project scope when defaultProjectId is provided", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <PromptForm
        defaultProjectId="proj-1"
        defaultValues={{
          title: "Project Specific Shortcut",
          shortcut: "pshort",
          content: "Project prompt content",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitMock.mock.calls[0][0]).toEqual({
      title: "Project Specific Shortcut",
      shortcut: "pshort",
      content: "Project prompt content",
      projectIds: ["proj-1"],
      assistantIds: [],
    });
  });

  it("renders with locked assistant scope when defaultAssistantId is provided", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <PromptForm
        defaultAssistantId="asst-1"
        defaultValues={{
          title: "Assistant Specific Shortcut",
          shortcut: "ashort",
          content: "Assistant prompt content",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitMock.mock.calls[0][0]).toEqual({
      title: "Assistant Specific Shortcut",
      shortcut: "ashort",
      content: "Assistant prompt content",
      projectIds: [],
      assistantIds: ["asst-1"],
    });
  });

  it("calls onCancel when cancel button is provided and clicked", async () => {
    const user = userEvent.setup();
    const onCancelMock = vi.fn();
    render(<PromptForm onSubmit={vi.fn()} onCancel={onCancelMock} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();
    await user.click(cancelButton);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
