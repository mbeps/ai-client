import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { INTERNAL_TOOL_IDS, PICKER_INTERNAL_TOOLS } from "@/config/tools";

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

describe("ToolPickerList - Interactive UI", () => {
  it("renders Interactive UI when expanded and toggles it", () => {
    const onToggleTool = vi.fn();

    render(
      <ToolPickerList
        servers={[]}
        selectedTools={new Set([INTERNAL_TOOL_IDS.INTERACTIVE_UI])}
        onToggleTool={onToggleTool}
        onBulkSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Internal Tools"));
    expect(screen.getByText("Interactive UI")).toBeDefined();
    expect(screen.getByText("1 selected")).toBeDefined();

    fireEvent.click(screen.getByText("Interactive UI"));
    expect(onToggleTool).toHaveBeenCalledWith("internal", "interactive_ui");
  });

  it("filters Interactive UI by search query and hides non-matching tools", () => {
    render(
      <ToolPickerList
        servers={[]}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      "Search tools and resources...",
    );
    fireEvent.change(searchInput, { target: { value: "chart" } });

    expect(screen.getByText("Interactive UI")).toBeDefined();
    expect(screen.queryByText("Memory")).toBeNull();
    expect(screen.queryByText(/No tools found matching/)).toBeNull();
  });

  it("bulk-selects all PICKER_INTERNAL_TOOLS including interactive_ui", () => {
    const onBulkSelect = vi.fn();

    render(
      <ToolPickerList
        servers={[]}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={onBulkSelect}
      />,
    );

    fireEvent.click(screen.getByText("Select All"));

    expect(onBulkSelect).toHaveBeenCalledWith(
      "internal",
      PICKER_INTERNAL_TOOLS.map((t) => t.toolName),
      true,
    );
  });
});
