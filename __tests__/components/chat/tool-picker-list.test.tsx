import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ToolPickerList,
  ToolPickerDialog,
} from "@/components/chat/tool-picker-list";
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
      ["manage_artifact"],
      true,
    );
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
      ["manage_artifact"],
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
        return element?.textContent === "1/1 selected tool";
      }),
    ).toBeDefined();
  });
});
