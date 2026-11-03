import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PromptCardItem,
  PromptGroupSection,
} from "@/components/chat/prompt-picker/prompt-group-section";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";

const mockItem: MentionPromptItem = {
  id: "prompt-1",
  title: "Code Review",
  shortcut: "review",
  description: "Review this diff carefully",
  isMcp: false,
  isSkill: false,
};

describe("PromptCardItem", () => {
  it("renders prompt title, shortcut, and description", () => {
    const onToggle = vi.fn();
    render(
      <PromptCardItem item={mockItem} isSelected={false} onToggle={onToggle} />,
    );

    expect(screen.getByText("Code Review")).toBeDefined();
    expect(screen.getByText("/review")).toBeDefined();
    expect(screen.getByText("Review this diff carefully")).toBeDefined();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(
      <PromptCardItem item={mockItem} isSelected={false} onToggle={onToggle} />,
    );

    await userEvent.click(screen.getByText("Code Review"));
    expect(onToggle).toHaveBeenCalledWith(mockItem);
  });
});

describe("PromptGroupSection", () => {
  const group = {
    id: "internal",
    name: "Internal Prompts",
    isInternal: true,
    items: [mockItem],
  };

  it("renders group header with title and toggles accordion", async () => {
    const onToggleExpand = vi.fn();
    render(
      <PromptGroupSection
        group={group}
        isExpanded={false}
        onToggleExpand={onToggleExpand}
      />,
    );

    expect(screen.getByText("Internal Prompts")).toBeDefined();
    expect(screen.queryByText("Code Review")).toBeNull();

    await userEvent.click(screen.getByText("Internal Prompts"));
    expect(onToggleExpand).toHaveBeenCalledWith("internal");
  });

  it("renders child cards when expanded", () => {
    render(
      <PromptGroupSection
        group={group}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />,
    );

    expect(screen.getByText("Code Review")).toBeDefined();
  });

  it("shows selected badge and supports group select-all checkbox toggle", () => {
    const onTogglePrompt = vi.fn();
    render(
      <PromptGroupSection
        group={group}
        isExpanded={true}
        selectedPromptIds={new Set(["prompt-1"])}
        onToggleExpand={vi.fn()}
        onTogglePrompt={onTogglePrompt}
      />,
    );

    expect(screen.getByText("1 selected")).toBeDefined();

    const groupCheckbox = screen.getByLabelText("Select all from Internal Prompts");
    fireEvent.click(groupCheckbox);
    expect(onTogglePrompt).toHaveBeenCalledWith(mockItem);
  });

  it("calls onBulkToggleGroup when provided", () => {
    const onBulkToggleGroup = vi.fn();
    render(
      <PromptGroupSection
        group={group}
        isExpanded={true}
        selectedPromptIds={new Set()}
        onToggleExpand={vi.fn()}
        onBulkToggleGroup={onBulkToggleGroup}
      />,
    );

    const groupCheckbox = screen.getByLabelText("Select all from Internal Prompts");
    fireEvent.click(groupCheckbox);
    expect(onBulkToggleGroup).toHaveBeenCalledWith(group, true);
  });
});

