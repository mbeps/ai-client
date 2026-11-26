import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServerToolsSection } from "@/components/chat/tool-picker/server-tools-section";
import type { McpServer } from "@/types/mcp";

describe("ServerToolsSection", () => {
  const server = { id: "srv-1", name: "GitHub" } as McpServer;

  it("renders error state and triggers onRetry", () => {
    const onRetry = vi.fn();
    render(
      <ServerToolsSection
        server={server}
        content={{ loading: false, error: "Connection failed", tools: [] }}
        search=""
        isExpanded={true}
        selectedTools={new Set()}
        onToggleExpand={vi.fn()}
        onRetry={onRetry}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Connection failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders empty tools state when expanded with no tools", () => {
    render(
      <ServerToolsSection
        server={server}
        content={{ loading: false, tools: [] }}
        search=""
        isExpanded={true}
        selectedTools={new Set()}
        onToggleExpand={vi.fn()}
        onRetry={vi.fn()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("No tools available")).toBeInTheDocument();
  });

  it("renders filtered tools, selected count badge, and triggers bulk select", () => {
    const onBulkSelect = vi.fn();
    const tools = [
      { name: "create_issue", description: "Create a GitHub issue" },
      { name: "list_prs", description: "List pull requests" },
    ];

    render(
      <ServerToolsSection
        server={server}
        content={{ loading: false, tools }}
        search="pull"
        isExpanded={true}
        selectedTools={new Set(["srv-1:tool:list_prs"])}
        onToggleExpand={vi.fn()}
        onRetry={vi.fn()}
        onToggleTool={vi.fn()}
        onBulkSelect={onBulkSelect}
      />,
    );

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("list_prs")).toBeInTheDocument();
    expect(screen.queryByText("create_issue")).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onBulkSelect).toHaveBeenCalledWith(
      "srv-1",
      ["create_issue", "list_prs"],
      true,
    );
  });
});
