import { render, screen, waitFor } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverMcpServerTools } from "@/lib/mcp/discover-mcp-server-tools";
import { McpItemList } from "@/components/mcp/mcp-item-list";
import type { McpServer } from "@/types/mcp/mcp-server";

vi.mock("@/lib/mcp/discover-mcp-server-tools", () => ({
  discoverMcpServerTools: vi.fn(),
}));

const mockServer = { id: "srv-1", name: "Test" } as McpServer;

describe("McpItemList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error card when discovery throws Error or non-Error, and empty state when empty", async () => {
    vi.mocked(discoverMcpServerTools).mockRejectedValueOnce(new Error("Network fail"));

    const { rerender } = render(
      <McpItemList
        server={mockServer}
        itemKind="tool"
        emptyMessage="No tools found"
        icon={Wrench}
        fetchItems={(r) => r.tools}
        getItemKey={(t) => t.name}
        getItemLabel={(t) => t.name}
        renderContent={() => null}
      />,
    );

    await waitFor(() => expect(screen.getByText("Network fail")).toBeInTheDocument());

    vi.mocked(discoverMcpServerTools).mockRejectedValueOnce("non-error");
    rerender(
      <McpItemList
        server={{ ...mockServer, id: "srv-2" }}
        itemKind="tool"
        emptyMessage="No tools found"
        icon={Wrench}
        fetchItems={(r) => r.tools}
        getItemKey={(t) => t.name}
        getItemLabel={(t) => t.name}
        renderContent={() => null}
      />,
    );
    await waitFor(() =>
      expect(screen.getAllByText("Failed to discover tools").length).toBeGreaterThanOrEqual(1),
    );

    vi.mocked(discoverMcpServerTools).mockResolvedValueOnce({ tools: [] } as any);
    rerender(
      <McpItemList
        server={{ ...mockServer, id: "srv-3" }}
        itemKind="tool"
        emptyMessage="No tools found"
        icon={Wrench}
        fetchItems={(r) => r.tools}
        getItemKey={(t) => t.name}
        getItemLabel={(t) => t.name}
        renderContent={() => null}
      />,
    );
    await waitFor(() => expect(screen.getByText("No tools found")).toBeInTheDocument());
  });
});
