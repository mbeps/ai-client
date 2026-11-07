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
      aria-label="skill-content-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { CreateSkillForm } from "@/components/skill/create-skill-form";
import { useAppStore } from "@/lib/store/use-app-store";

describe("CreateSkillForm", () => {
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
      <CreateSkillForm
        defaultValues={{
          name: "test-skill",
          displayName: "Test Skill",
          description: "Skill description",
          content: "Instructions content",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Test Skill")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test-skill")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Skill description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Instructions content")).toBeInTheDocument();
  });

  it("calls onSubmit when submitted with valid global values", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <CreateSkillForm
        defaultValues={{
          name: "global-skill",
          displayName: "Global Skill",
          description: "Description",
          content: "Instructions content",
          scope: "global",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /create skill/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "global-skill",
          displayName: "Global Skill",
          scope: "global",
          projectId: null,
          assistantId: null,
        }),
      );
    });
  });

  it("locks scope and project when defaultProjectId is passed", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <CreateSkillForm
        defaultProjectId="proj-1"
        defaultValues={{
          name: "project-skill",
          displayName: "Project Skill",
          description: "Description",
          content: "Content",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toBeDisabled(); // Scope select

    const submitBtn = screen.getByRole("button", { name: /create skill/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "project-skill",
          displayName: "Project Skill",
          scope: "project",
          projectId: "proj-1",
          assistantId: null,
        }),
      );
    });
  });

  it("locks scope and assistant when defaultAssistantId is passed", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <CreateSkillForm
        defaultAssistantId="asst-1"
        defaultValues={{
          name: "asst-skill",
          displayName: "Assistant Skill",
          description: "Description",
          content: "Content",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toBeDisabled(); // Scope select

    const submitBtn = screen.getByRole("button", { name: /create skill/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "asst-skill",
          displayName: "Assistant Skill",
          scope: "assistant",
          projectId: null,
          assistantId: "asst-1",
        }),
      );
    });
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancelMock = vi.fn();

    render(
      <CreateSkillForm
        onSubmit={vi.fn()}
        onCancel={onCancelMock}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(onCancelMock).toHaveBeenCalled();
  });
});
