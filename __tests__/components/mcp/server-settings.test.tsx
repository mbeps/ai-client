import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { listMcpServers } from "@/actions/mcp-servers/list-mcp-servers";
import { ServerSettings } from "@/components/mcp/server-settings";
import { useAppStore } from "@/lib/store/use-app-store";
import type { McpServer } from "@/types/mcp/mcp-server";

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/actions/mcp-servers/delete-mcp-server", () => ({
  deleteMcpServer: vi.fn(),
}));

vi.mock("@/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockOwnedServer: McpServer = {
  id: "srv-owned",
  userId: "user-1",
  name: "My Custom Server",
  url: "https://mcp.custom.com/sse",
  headers: "{}",
  isPublic: false,
  isInstalled: false,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInstalledServer: McpServer = {
  id: "srv-installed",
  userId: "user-2",
  name: "Community Server",
  url: "https://mcp.community.com/sse",
  headers: "{}",
  isPublic: true,
  isInstalled: true,
  installId: "inst-999",
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ServerSettings UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      mcpServers: [mockOwnedServer, mockInstalledServer],
    });
  });

  it("renders 'Delete Server' for owned server and uninstalls/reloads on confirmation", async () => {
    vi.mocked(deleteMcpServer).mockResolvedValueOnce({ deletedCount: 1 });
    vi.mocked(listMcpServers).mockResolvedValueOnce([mockInstalledServer]);

    render(<ServerSettings serverId="srv-owned" />);

    // Header and trigger button should show "Delete Server"
    expect(screen.getAllByText("Delete Server").length).toBeGreaterThan(0);
    expect(screen.queryByText("Uninstall Tool")).not.toBeInTheDocument();

    // Click Delete Server trigger button
    const deleteBtn = screen.getByRole("button", { name: /delete server/i });
    fireEvent.click(deleteBtn);

    // Confirm dialog appears
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteMcpServer).toHaveBeenCalledWith("srv-owned");
      expect(listMcpServers).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/settings/connectors");
      expect(toast.success).toHaveBeenCalledWith("MCP server deleted");
    });
  });

  it("renders 'Uninstall Tool' for installed community server and uninstalls/reloads on confirmation", async () => {
    vi.mocked(deleteMcpServer).mockResolvedValueOnce({ deletedCount: 1 });
    vi.mocked(listMcpServers).mockResolvedValueOnce([mockOwnedServer]);

    render(<ServerSettings serverId="srv-installed" />);

    // Header and trigger button should show "Uninstall Tool"
    expect(screen.getAllByText("Uninstall Tool").length).toBeGreaterThan(0);
    expect(screen.queryByText("Delete Server")).not.toBeInTheDocument();
    expect(
      screen.getByText("Remove this community tool subscription from your account."),
    ).toBeInTheDocument();

    // Click Uninstall Tool trigger button
    const uninstallBtn = screen.getByRole("button", { name: /uninstall tool/i });
    fireEvent.click(uninstallBtn);

    // Confirm dialog appears
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteMcpServer).toHaveBeenCalledWith("srv-installed");
      expect(listMcpServers).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/settings/connectors");
      expect(toast.success).toHaveBeenCalledWith("Tool uninstalled");
    });
  });
});

