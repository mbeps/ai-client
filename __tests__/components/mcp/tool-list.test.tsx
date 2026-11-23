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

  it("renders per-tool approval tabs with label only on selected option and no nested buttons", async () => {
    const { container } = render(<ToolList server={createServer()} />);

    const searchAlwaysAllow = await screen.findByRole("radio", {
      name: "Always allow search",
    });
    const searchNeedsApproval = screen.getByRole("radio", {
      name: "Needs approval search",
    });
    const deleteAlwaysAllow = screen.getByRole("radio", {
      name: "Always allow delete_item",
    });
    const deleteNeedsApproval = screen.getByRole("radio", {
      name: "Needs approval delete_item",
    });

    expect(searchAlwaysAllow).toHaveAttribute("aria-checked", "true");
    expect(searchNeedsApproval).toHaveAttribute("aria-checked", "false");
    expect(searchAlwaysAllow).toHaveTextContent("Always allow");
    expect(searchNeedsApproval).not.toHaveTextContent("Needs approval");

    expect(deleteAlwaysAllow).toHaveAttribute("aria-checked", "false");
    expect(deleteNeedsApproval).toHaveAttribute("aria-checked", "true");
    expect(deleteAlwaysAllow).not.toHaveTextContent("Always allow");
    expect(deleteNeedsApproval).toHaveTextContent("Needs approval");

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

    const deleteAlwaysAllow = await screen.findByRole("radio", {
      name: "Always allow delete_item",
    });
    fireEvent.click(deleteAlwaysAllow);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: ["search", "delete_item"],
      });
    });
    expect(mockLoadMcpServers).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("disables auto-approval for a single tool when Needs approval is selected", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: true,
      value: { autoApprovedTools: [] },
    });

    render(<ToolList server={createServer({ autoApprovedTools: ["search"] })} />);

    const searchNeedsApproval = await screen.findByRole("radio", {
      name: "Needs approval search",
    });
    fireEvent.click(searchNeedsApproval);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: [],
      });
    });
  });

  it("supports batch Always allow and Needs approval dropdown actions", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: true,
      value: { autoApprovedTools: ["search", "delete_item"] },
    });

    render(<ToolList server={createServer({ autoApprovedTools: [] })} />);

    const batchTrigger = await screen.findByRole("button", {
      name: /Needs approval/i,
    });
    fireEvent.pointerDown(batchTrigger);
    fireEvent.click(batchTrigger);

    const alwaysAllowItem = await screen.findByRole("menuitem", {
      name: /Always allow/i,
    });
    fireEvent.click(alwaysAllowItem);

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

    const updatedTrigger = await screen.findByRole("button", {
      name: /Always allow/i,
    });
    fireEvent.pointerDown(updatedTrigger);
    fireEvent.click(updatedTrigger);

    const needsApprovalItem = await screen.findByRole("menuitem", {
      name: /Needs approval/i,
    });
    fireEvent.click(needsApprovalItem);

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: [],
      });
    });
  });

  it("shows Custom in batch dropdown when tools have mixed approval states", async () => {
    render(<ToolList server={createServer({ autoApprovedTools: ["search"] })} />);

    const batchTrigger = await screen.findByRole("button", {
      name: /Custom/i,
    });
    expect(batchTrigger).toBeInTheDocument();
  });

  it("reverts optimistic state and shows error toast when update fails", async () => {
    mockUpdateMcpToolApprovals.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Server not found" },
    });

    render(<ToolList server={createServer({ autoApprovedTools: [] })} />);

    const searchAlwaysAllow = await screen.findByRole("radio", {
      name: "Always allow search",
    });
    expect(searchAlwaysAllow).toHaveAttribute("aria-checked", "false");

    fireEvent.click(searchAlwaysAllow);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Server not found");
    });
    expect(searchAlwaysAllow).toHaveAttribute("aria-checked", "false");
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
