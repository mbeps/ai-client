const mockDiscoverMcpServerTools = vi.hoisted(() => vi.fn());
const mockUpdateMcpToolApprovals = vi.hoisted(() => vi.fn());
const mockLoadMcpServers = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mcp/discover-mcp-server-tools", () => ({
  discoverMcpServerTools: mockDiscoverMcpServerTools,
}));

vi.mock("@/actions/mcp-servers/update-mcp-tool-approvals", () => ({
  updateMcpToolApprovals: mockUpdateMcpToolApprovals,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: { loadMcpServers: typeof mockLoadMcpServers }) => unknown) =>
    selector({ loadMcpServers: mockLoadMcpServers }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolList } from "@/components/mcp/tool-list";
import type { McpServer } from "@/types/mcp/mcp-server";

function createServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: "srv-1",
    userId: "user-1",
    name: "Test Server",
    url: "https://example.com/mcp",
    enabled: true,
    isPublic: false,
    autoApprovedTools: ["search"],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ToolList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadMcpServers.mockResolvedValue(undefined);
    mockDiscoverMcpServerTools.mockResolvedValue({
      tools: [
        {
          name: "search",
          description: "Search docs",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
            },
            required: ["query"],
          },
        },
        {
          name: "delete_item",
          description: "Delete an item",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      resources: [],
      prompts: [],
    });
  });

  it("renders per-tool approval switches as siblings of accordion triggers without nested buttons", async () => {
    const { container } = render(<ToolList server={createServer()} />);

    const searchSwitch = await screen.findByRole("switch", {
      name: "Auto-approve search",
    });
    const deleteSwitch = screen.getByRole("switch", {
      name: "Auto-approve delete_item",
    });

    expect(searchSwitch).toBeChecked();
    expect(deleteSwitch).not.toBeChecked();

    // Ensure no <button> is nested inside another <button>
    const nestedButtons = container.querySelectorAll("button button");
    expect(nestedButtons).toHaveLength(0);
  });

  it("toggles a single tool approval and prunes stale tool names", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: true,
      value: { autoApprovedTools: ["search", "delete_item"] },
    });

    render(
      <ToolList
        server={createServer({
          autoApprovedTools: ["search", "stale_removed_tool"],
        })}
      />,
    );

    const deleteSwitch = await screen.findByRole("switch", {
      name: "Auto-approve delete_item",
    });
    fireEvent.click(deleteSwitch);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: ["search", "delete_item"],
      });
    });
    expect(mockLoadMcpServers).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("disables auto-approval for a single tool when toggled off", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: true,
      value: { autoApprovedTools: [] },
    });

    render(<ToolList server={createServer({ autoApprovedTools: ["search"] })} />);

    const searchSwitch = await screen.findByRole("switch", {
      name: "Auto-approve search",
    });
    fireEvent.click(searchSwitch);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: [],
      });
    });
  });

  it("supports bulk Auto-approve all and Require approval for all", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: true,
      value: { autoApprovedTools: ["search", "delete_item"] },
    });

    render(<ToolList server={createServer({ autoApprovedTools: [] })} />);

    const approveAllBtn = await screen.findByRole("button", {
      name: "Auto-approve all",
    });
    fireEvent.click(approveAllBtn);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: ["search", "delete_item"],
      });
    });

    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: true,
      value: { autoApprovedTools: [] },
    });

    const requireAllBtn = await screen.findByRole("button", {
      name: "Require approval for all",
    });
    fireEvent.click(requireAllBtn);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: [],
      });
    });
  });

  it("reverts optimistic state and shows error toast when update fails", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Server not found" },
    });

    render(<ToolList server={createServer({ autoApprovedTools: [] })} />);

    const searchSwitch = await screen.findByRole("switch", {
      name: "Auto-approve search",
    });
    expect(searchSwitch).not.toBeChecked();

    fireEvent.click(searchSwitch);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Server not found");
    });
    expect(searchSwitch).not.toBeChecked();
  });

  it("renders tool description and parameter schema when accordion is expanded", async () => {
    render(<ToolList server={createServer()} />);

    const trigger = await screen.findByRole("button", { name: /search/i });
    fireEvent.click(trigger);

    expect(await screen.findByText("Search docs")).toBeInTheDocument();
    expect(screen.getByText("query")).toBeInTheDocument();
    expect(screen.getByText("Search query")).toBeInTheDocument();
  });
});
