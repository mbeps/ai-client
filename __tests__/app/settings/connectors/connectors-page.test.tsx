import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConnectorsPage from "@/app/settings/connectors/page";
import type { McpServer } from "@/types/mcp/mcp-server";

const mockLoadMcpServers = vi.fn();

const mockServers: McpServer[] = [
  {
    id: "srv-3",
    userId: "user-1",
    name: "Mock Public Tools",
    url: "https://example.com/mcp",
    enabled: false,
    isPublic: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-01"), // Most recently updated
  },
  {
    id: "srv-1",
    userId: "user-1",
    name: "Excel MCP",
    url: "http://127.0.0.1:8765/mcp",
    enabled: true,
    isPublic: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"), // Oldest
  },
  {
    id: "srv-2",
    userId: "user-1",
    name: "Maruf",
    url: "https://www.maruf-bepary.com/api/mcp",
    enabled: false,
    isPublic: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"), // Middle
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      mcpServers: mockServers,
      loadMcpServers: mockLoadMcpServers,
      loadError: null,
    }),
}));

describe("ConnectorsPage", () => {
  it("renders MCP servers in alphabetical order regardless of updatedAt recency", () => {
    const { container } = render(<ConnectorsPage />);

    expect(screen.getByText("Connectors")).toBeInTheDocument();
    expect(mockLoadMcpServers).toHaveBeenCalled();

    // Check headings of the rendered server cards
    const serverHeadings = container.querySelectorAll("h3");
    const names = Array.from(serverHeadings).map((h) => h.textContent);

    expect(names).toEqual(["Excel MCP", "Maruf", "Mock Public Tools"]);
  });
});

