import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptGroupSection } from "@/components/chat/prompt-picker/prompt-group-section";
import { groupPromptsByCategory } from "@/components/chat/prompt-picker/prompt-picker-utils";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";

describe("prompt-picker coverage", () => {
  it("buildPromptGroups deduplicates mcpServerMap entries for multiple prompts on same server", () => {
    const mcpPrompts: DiscoveredPrompt[] = [
      {
        name: "p1",
        serverId: "srv-1",
        serverName: "Server 1",
        description: "First",
        arguments: [],
      },
      {
        name: "p2",
        serverId: "srv-1",
        serverName: "Server 1",
        description: "Second",
        arguments: [],
      },
    ];
    const items: MentionPromptItem[] = mcpPrompts.map((p) => ({
      id: `mcp:${p.serverId}:${p.name}`,
      name: p.name,
      description: p.description,
      isMcp: true,
      serverId: p.serverId,
      serverName: p.serverName,
    }));

    const groups = groupPromptsByCategory(items, [], mcpPrompts);
    expect(groups.length).toBe(1);
    expect(groups[0].items.length).toBe(2);
  });

  it("PromptGroupSection toggles items individually when onBulkToggleGroup is omitted", () => {
    const onTogglePrompt = vi.fn();
    const item1: MentionPromptItem = {
      id: "p1",
      name: "Prompt 1",
      description: "",
      isMcp: false,
    };
    const item2: MentionPromptItem = {
      id: "p2",
      name: "Prompt 2",
      description: "",
      isMcp: false,
    };
    const group = {
      id: "g1",
      label: "Group 1",
      isInternal: true,
      items: [item1, item2],
    };

    const { rerender } = render(
      <PromptGroupSection
        group={group}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        selectedPromptIds={new Set(["p1"])}
        onTogglePrompt={onTogglePrompt}
        isMultiSelect={true}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onTogglePrompt).toHaveBeenCalledTimes(1);
    expect(onTogglePrompt).toHaveBeenCalledWith(item1);

    onTogglePrompt.mockClear();
    rerender(
      <PromptGroupSection
        group={group}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        selectedPromptIds={new Set()}
        onTogglePrompt={onTogglePrompt}
        isMultiSelect={true}
      />,
    );

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onTogglePrompt).toHaveBeenCalledTimes(2);
  });

  it("handles PromptPicker collapse, missing selectedPromptIds, and maxHeight", async () => {
    const { PromptPicker } = await import("@/components/chat/prompt-picker");
    render(
      <PromptPicker
        prompts={[
          {
            id: "p-1",
            name: "First",
            content: "Hello",
            description: "Desc",
            tags: [],
            isPublic: false,
            userId: "u-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never,
        ]}
        mcpPrompts={[
          {
            id: "mcp-1",
            serverId: "srv-1",
            serverName: "Srv",
            name: "mcp_p",
            description: "d",
          } as never,
        ]}
        maxHeight="200px"
      />,
    );

    // Click Select All when neither onSelectAll nor onTogglePrompt/selectedPromptIds is provided
    fireEvent.click(screen.getByText("Select All"));

    // Collapse the group header and then re-expand it
    fireEvent.click(screen.getByText("Srv"));
    fireEvent.click(screen.getByText("Srv"));

    // Render with maxHeight
    render(
      <PromptPicker
        prompts={[]}
        mcpPrompts={[]}
        onSelect={vi.fn()}
        maxHeight="300px"
      />,
    );
  });
});
