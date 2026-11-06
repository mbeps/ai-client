import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectToolsTab } from "@/components/project/project-tools-tab";
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

describe("ProjectToolsTab", () => {
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

  it("renders tools list container without border class", async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(
        <ProjectToolsTab
          mcpServers={mockServers}
          selectedTools={new Set()}
          onToggleTool={vi.fn()}
          onBulkSelect={vi.fn()}
          onSave={vi.fn()}
        />,
      );
      container = rendered.container;
    });

    const toolsContainer = container!.querySelector(".max-h-\\[500px\\]");
    expect(toolsContainer).not.toBeNull();
    expect(toolsContainer?.classList.contains("border")).toBe(false);
    expect(screen.getByText("Default Tools")).toBeDefined();
    expect(screen.getByRole("button", { name: /save tools/i })).toBeDefined();
  });
});
