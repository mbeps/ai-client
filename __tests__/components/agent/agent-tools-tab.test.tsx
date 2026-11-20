import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentToolsTab } from "@/components/agent/agent-tools-tab";
import type { McpServer } from "@/types/mcp/mcp-server";

const mockServers: McpServer[] = [
  {
    id: "srv-1",
    name: "GitHub",
    url: "https://example.com/mcp",
    enabled: true,
    userId: "user-1",
    authType: "none",
    status: "connected",
    tools: [
      {
        name: "create_issue",
        description: "Create a GitHub issue",
        inputSchema: {},
      },
    ],
    resources: [],
    prompts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as McpServer,
  {
    id: "srv-disabled",
    name: "Disabled Server",
    url: "https://example.com/disabled",
    enabled: false,
    userId: "user-1",
    authType: "none",
    status: "disconnected",
    tools: [],
    resources: [],
    prompts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as McpServer,
];

describe("AgentToolsTab", () => {
  it("renders ToolPickerList with only enabled servers", () => {
    render(
      <AgentToolsTab
        mcpServers={mockServers}
        selectedTools={new Set(["srv-1:tool:create_issue"])}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Default Tools")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("Disabled Server")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save Tools/i }),
    ).toBeInTheDocument();
  });

  it("hides save button when disabled is true", () => {
    render(
      <AgentToolsTab
        mcpServers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        onSave={vi.fn()}
        disabled
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Save Tools/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <AgentToolsTab
        mcpServers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        onSave={onSave}
        saveLabel="Create Agent"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Agent/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
