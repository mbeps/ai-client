import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentionCommands } from "@/components/chat/mention-commands";
import type { MentionItem } from "@/hooks/chat/use-mention-commands";

describe("MentionCommands", () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  it("renders skills section heading with icon and without item icons", () => {
    const items: MentionItem[] = [
      {
        id: "skill-1",
        name: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        isSkill: true,
      } as any,
    ];

    const { container } = render(
      <MentionCommands
        items={items}
        trigger="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Test Skill")).toBeInTheDocument();
    expect(screen.getByText("/test-skill")).toBeInTheDocument();

    const groupHeading = container.querySelector("[cmdk-group-heading]");
    expect(groupHeading).toBeInTheDocument();
    expect(groupHeading?.querySelector("svg")).toBeInTheDocument();

    const commandItem = container.querySelector("[cmdk-item]");
    expect(commandItem?.querySelector("svg")).toBeNull();
  });

  it("renders prompts section heading with icon and without item icons", () => {
    const items: MentionItem[] = [
      {
        id: "prompt-1",
        title: "Test Prompt",
        shortcut: "test",
        content: "Prompt content",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const { container } = render(
      <MentionCommands
        items={items}
        trigger="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Prompts")).toBeInTheDocument();
    expect(screen.getByText("Test Prompt")).toBeInTheDocument();

    const groupHeading = container.querySelector("[cmdk-group-heading]");
    expect(groupHeading?.querySelector("svg")).toBeInTheDocument();

    const commandItem = container.querySelector("[cmdk-item]");
    expect(commandItem?.querySelector("svg")).toBeNull();
  });

  it("renders assistants section heading with icon and without item icons", () => {
    const items: MentionItem[] = [
      {
        id: "asst-1",
        name: "Test Assistant",
        description: "Helpful assistant",
        avatar: null,
        instructions: "Do stuff",
        tools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ];

    const { container } = render(
      <MentionCommands
        items={items}
        trigger="@"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Assistants")).toBeInTheDocument();
    expect(screen.getByText("Test Assistant")).toBeInTheDocument();

    const groupHeading = container.querySelector("[cmdk-group-heading]");
    expect(groupHeading?.querySelector("svg")).toBeInTheDocument();

    const commandItem = container.querySelector("[cmdk-item]");
    expect(commandItem?.querySelector("svg")).toBeNull();
  });

  it("renders knowledgebases section heading with icon and without item icons", () => {
    const items: MentionItem[] = [
      {
        id: "kb-1",
        name: "Test KB",
        description: "Test knowledgebase",
        documentCount: 5,
        indexStatus: "ready",
      },
    ];

    const { container } = render(
      <MentionCommands
        items={items}
        trigger="#"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Knowledgebases")).toBeInTheDocument();
    expect(screen.getByText("Test KB")).toBeInTheDocument();

    const groupHeading = container.querySelector("[cmdk-group-heading]");
    expect(groupHeading?.querySelector("svg")).toBeInTheDocument();

    const commandItem = container.querySelector("[cmdk-item]");
    expect(commandItem?.querySelector("svg")).toBeNull();
  });
});
