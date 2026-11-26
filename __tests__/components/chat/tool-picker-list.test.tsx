import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { ToolPickerDialog } from "@/components/chat/tool-picker/tool-picker-dialog";
import type { McpServer } from "@/types/mcp/mcp-server";

// Mock env
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/mcp/discover-mcp-server-tools", () => ({
  discoverMcpServerTools: vi.fn().mockResolvedValue({ tools: [] }),
}));

const mockServers: McpServer[] = [
  {
    id: "srv-1",
    userId: "u1",
    name: "Excel MCP",
    url: "https://example.com/mcp",
    isPublic: false,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("ToolPickerList", () => {
  it("renders internal tools and server names", () => {
    render(
      <ToolPickerList
        servers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Internal Tools")).toBeDefined();
    expect(screen.getByText("Excel MCP")).toBeDefined();
    expect(screen.getByText("Select All")).toBeDefined();
  });

  it("ignores disabled MCP servers and does not discover their tools", async () => {
    const serversWithDisabled: McpServer[] = [
      ...mockServers,
      {
        id: "srv-disabled",
        userId: "u1",
        name: "Disabled Server",
        url: "https://example.com/disabled",
        isPublic: false,
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await act(async () => {
      render(
        <ToolPickerList
          servers={serversWithDisabled}
          selectedTools={new Set()}
          onToggleTool={vi.fn()}
          onBulkSelect={vi.fn()}
        />,
      );
    });

    expect(screen.getByText("Excel MCP")).toBeDefined();
    expect(screen.queryByText("Disabled Server")).toBeNull();
  });

  it("filters tools and servers by search", () => {
    render(
      <ToolPickerList
        servers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      "Search tools and resources...",
    );
    fireEvent.change(searchInput, { target: { value: "Excel" } });

    expect(screen.getByText("Excel MCP")).toBeDefined();
  });

  it("calls onBulkSelect when Select All is clicked", () => {
    const handleBulkSelect = vi.fn();
    render(
      <ToolPickerList
        servers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={handleBulkSelect}
      />,
    );

    const selectAllBtn = screen.getByText("Select All");
    fireEvent.click(selectAllBtn);

    expect(handleBulkSelect).toHaveBeenCalledWith(
      "internal",
      ["manage_artifact", "manage_memory", "interactive_ui"],
      true,
    );
  });

  it("calls onBulkSelectBatch in a single call when provided", () => {
    const handleBulkSelect = vi.fn();
    const handleBulkSelectBatch = vi.fn();
    render(
      <ToolPickerList
        servers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={handleBulkSelect}
        onBulkSelectBatch={handleBulkSelectBatch}
      />,
    );

    fireEvent.click(screen.getByText("Select All"));
    expect(handleBulkSelectBatch).toHaveBeenCalledTimes(1);
    expect(handleBulkSelectBatch).toHaveBeenCalledWith(
      [
        {
          serverId: "internal",
          toolNames: ["manage_artifact", "manage_memory", "interactive_ui"],
        },
        {
          serverId: "srv-1",
          toolNames: [],
        },
      ],
      true,
    );
    expect(handleBulkSelect).not.toHaveBeenCalled();
  });

  it("calls onBulkSelect when section checkbox on accordion header is clicked", () => {
    const handleBulkSelect = vi.fn();
    render(
      <ToolPickerList
        servers={mockServers}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={handleBulkSelect}
      />,
    );

    const internalCheckbox = screen.getByLabelText(
      "Select all internal tools",
    );
    fireEvent.click(internalCheckbox);

    expect(handleBulkSelect).toHaveBeenCalledWith(
      "internal",
      ["manage_artifact", "manage_memory", "interactive_ui"],
      true,
    );
  });
});

describe("ToolPickerDialog", () => {
  it("renders dialog with Manage Tools link and selected count", () => {
    render(
      <ToolPickerDialog
        servers={mockServers}
        selectedTools={new Set(["internal:tool:manage_artifact"])}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        trigger={<button type="button">Open Tools</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open Tools"));
    expect(screen.getByText("Select Tools")).toBeDefined();
    expect(screen.getByText("Manage Tools")).toBeDefined();
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === "1/3 selected tools";
      }),
    ).toBeDefined();
  });

  it("handles server discovery failure, retry, expand/collapse, search no-match, and toggleAll", async () => {
    const { discoverMcpServerTools } = await import("@/lib/mcp/discover-mcp-server-tools");
    vi.mocked(discoverMcpServerTools)
      .mockRejectedValueOnce("non-error failure")
      .mockResolvedValueOnce({
        tools: [{ name: "remote_tool", description: "Remote desc" }],
      } as any);

    const onBulkSelectBatch = vi.fn();
    const onToggleTool = vi.fn();
    const onBulkSelect = vi.fn();

    render(
      <ToolPickerList
        servers={[
          { id: "srv-1", name: "Server One", enabled: true } as any,
        ]}
        selectedTools={new Set()}
        onToggleTool={onToggleTool}
        onBulkSelect={onBulkSelect}
        onBulkSelectBatch={onBulkSelectBatch}
      />,
    );

    // Expand Server One to see Retry button
    fireEvent.click(await screen.findByText("Server One"));
    const retryBtn = await screen.findByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);

    // Wait for successful discovery
    await screen.findByText("Server One");

    // Expand and collapse server section
    fireEvent.click(screen.getByText("Server One"));
    fireEvent.click(screen.getByText("Server One"));

    // Select All via onBulkSelectBatch
    fireEvent.click(screen.getByText("Select All"));
    expect(onBulkSelectBatch).toHaveBeenCalled();

    // Search with no match
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "zzzzz_no_match" },
    });
    expect(screen.getByText(/No tools found matching/)).toBeDefined();
  });

  it("handles singular tool count, all-selected state for MCP server, and Error instance rejection", async () => {
    const { discoverMcpServerTools } = await import("@/lib/mcp/discover-mcp-server-tools");
    vi.mocked(discoverMcpServerTools)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        tools: [{ name: "only_tool", description: "Single" }],
      } as any);

    render(
      <ToolPickerList
        servers={[
          {
            id: "srv-err",
            name: "Error Server",
            url: "http://localhost:9999",
            enabled: true,
          } as never,
        ]}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Error Server"));
    await screen.findByText("Network error");

    render(
      <ToolPickerList
        servers={[
          {
            id: "srv-one",
            name: "One Tool Server",
            url: "http://localhost:9998",
            enabled: true,
          } as never,
        ]}
        selectedTools={
          new Set([
            "internal:tool:manage_artifact",
            "internal:tool:manage_memory",
            "internal:tool:interactive_ui",
            "srv-one:tool:only_tool",
          ])
        }
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    await screen.findByText("Deselect All");
  });

  it("renders singular 'tool' when totalCount is 1", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tools: [{ name: "only_one", description: "One" }],
      }),
    }) as never;

    const { rerender } = render(
      <ToolPickerList
        servers={[
          {
            id: "srv-single",
            name: "Single",
            url: "http://localhost:9997",
            enabled: true,
          } as never,
        ]}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        includeInternalTools={false}
      />,
    );

    expect(
      await screen.findByText((_, el) => el?.textContent === "1 tool available"),
    ).toBeInTheDocument();

    rerender(
      <ToolPickerList
        servers={[
          {
            id: "srv-single",
            name: "Single",
            url: "http://localhost:9997",
            enabled: true,
          } as never,
        ]}
        selectedTools={new Set(["srv-single:tool:only_one"])}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        includeInternalTools={false}
      />,
    );

    expect(
      screen.getByText((_, el) => el?.textContent === "1/1 selected tool"),
    ).toBeInTheDocument();
  });
});
