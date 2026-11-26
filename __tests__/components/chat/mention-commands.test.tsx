import { fireEvent, render, screen } from "@testing-library/react";
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
        trigger="/"
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
        trigger="/"
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

  it("renders all four groups when trigger is /", () => {
    const items: MentionItem[] = [
      {
        id: "skill-1",
        name: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        isSkill: true,
      } as any,
      {
        id: "prompt-1",
        title: "Test Prompt",
        shortcut: "test",
        content: "Prompt content",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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
      {
        id: "kb-1",
        name: "Test KB",
        description: "Test knowledgebase",
        documentCount: 5,
        indexStatus: "ready",
      },
    ];

    render(
      <MentionCommands
        items={items}
        trigger="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Prompts")).toBeInTheDocument();
    expect(screen.getByText("Assistants")).toBeInTheDocument();
    expect(screen.getByText("Knowledgebases")).toBeInTheDocument();
    expect(screen.getByText("Test Skill")).toBeInTheDocument();
    expect(screen.getByText("Test Prompt")).toBeInTheDocument();
    expect(screen.getByText("Test Assistant")).toBeInTheDocument();
    expect(screen.getByText("Test KB")).toBeInTheDocument();
  });

  it.each([
    [undefined, "No items found."],
    ["skill" as const, "No skills found."],
    ["prompt" as const, "No prompts found."],
    ["agent" as const, "No assistants found."],
    ["knowledgebase" as const, "No knowledgebases found."],
  ])("renders empty state for typeFilter=%s when no items match", (typeFilter, expectedText) => {
    render(
      <MentionCommands
        items={[]}
        trigger="/"
        typeFilter={typeFilter}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("uses item.id as CommandItem value for action items so cmdk selection matches", () => {
    const items: MentionItem[] = [
      {
        id: "action:compact",
        name: "compact",
        title: "Compact Conversation",
        description: "Summarize older turns",
        isAction: true,
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

    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Compact Conversation")).toBeInTheDocument();
    const commandItem = container.querySelector("[cmdk-item]");
    expect(commandItem).toHaveAttribute("data-value", "action:compact");
    expect(commandItem).toHaveAttribute("aria-selected", "true");
  });

  it("returns null when trigger is null, renders action empty message, and calls onSelect for each item type", () => {
    const { container, rerender } = render(
      <MentionCommands
        items={[]}
        trigger={null}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <MentionCommands
        items={[]}
        trigger="/"
        typeFilter="action"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("No actions found.")).toBeInTheDocument();

    const items: MentionItem[] = [
      { id: "s1", name: "sk", isSkill: true } as any,
      {
        id: "p-mcp",
        name: "mcp-cmd",
        isMcp: true,
        sourceServer: "GitHub",
      } as any,
      { id: "a1", name: "Asst", tools: [] } as any,
      {
        id: "k1",
        name: "KB",
        documentCount: 1,
        indexStatus: "ready",
      } as any,
      {
        id: "action:compact",
        title: "Compact",
        name: "compact",
        description: "Compact conversation",
        isAction: true,
      } as any,
    ];

    rerender(
      <MentionCommands
        items={items}
        trigger="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("sk"));
    fireEvent.click(screen.getByText("mcp-cmd"));
    fireEvent.click(screen.getByText("Asst"));
    fireEvent.click(screen.getByText("KB"));
    fireEvent.click(screen.getByText("Compact"));
    expect(onSelect).toHaveBeenCalledTimes(5);
  });

  it("renders and selects both regular and MCP prompt items", () => {
    const items: MentionItem[] = [
      {
        id: "p-reg",
        title: "Regular Prompt",
        shortcut: "/reg",
        content: "hi",
      } as any,
      {
        id: "p-mcp",
        name: "MCP Prompt",
        title: "MCP Prompt",
        shortcut: "",
        sourceServer: "srv-1",
        isMcp: true,
      } as any,
    ];

    render(
      <MentionCommands
        items={items}
        trigger="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("/reg")).toBeInTheDocument();
    expect(screen.getByText("srv-1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Regular Prompt"));
    fireEvent.click(screen.getByText("MCP Prompt"));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
