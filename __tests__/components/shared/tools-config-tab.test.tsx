import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolsConfigTab } from "@/components/shared/tools-config-tab";
import type { McpServer } from "@/types/mcp/mcp-server";

vi.mock("@/lib/mcp/discover-mcp-server-tools", () => ({
  discoverMcpServerTools: vi.fn().mockResolvedValue({ tools: [] }),
}));

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

describe("ToolsConfigTab", () => {
  it("renders ToolPickerList with only enabled servers and without border class", async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(
        <ToolsConfigTab
          mcpServers={mockServers}
          selectedTools={new Set(["srv-1:tool:create_issue"])}
          onToggleTool={vi.fn()}
          onBulkSelect={vi.fn()}
          onSave={vi.fn()}
          description="Select tools for this entity."
        />,
      );
      container = rendered.container;
    });

    const toolsContainer = container!.querySelector(".max-h-\\[500px\\]");
    expect(toolsContainer).not.toBeNull();
    expect(toolsContainer?.classList.contains("border")).toBe(false);
    expect(screen.getByText("Default Tools")).toBeInTheDocument();
    expect(screen.getByText("Select tools for this entity.")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("Disabled Server")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save Tools/i }),
    ).toBeInTheDocument();
  });

  it("hides save button and dims container when disabled is true", () => {
    const { container } = render(
      <ToolsConfigTab
        mcpServers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        onSave={vi.fn()}
        disabled
      />,
    );

    expect(
      container.querySelector(".pointer-events-none.opacity-60"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Save Tools/i }),
    ).not.toBeInTheDocument();
  });

  it("disables save button while saving and calls onSave when clicked", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <ToolsConfigTab
        mcpServers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        onSave={onSave}
        saveLabel="Create Agent"
        isSaving
      />,
    );

    expect(
      screen.getByRole("button", { name: /Create Agent/i }),
    ).toBeDisabled();

    rerender(
      <ToolsConfigTab
        mcpServers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        onSave={onSave}
        saveLabel="Create Agent"
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Agent/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
