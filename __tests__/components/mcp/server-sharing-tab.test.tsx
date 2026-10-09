import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toggleMcpServerPublic } from "@/actions/mcp-servers/toggle-mcp-server-public";
import { ServerSharingTab } from "@/components/mcp/server-sharing-tab";
import { useAppStore } from "@/lib/store";
import type { McpServer } from "@/types/mcp/mcp-server";

vi.mock("@/actions/mcp-servers/toggle-mcp-server-public", () => ({
  toggleMcpServerPublic: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockServer: McpServer = {
  id: "srv-1",
  userId: "user-1",
  name: "GitHub Tools",
  url: "https://mcp.github.com/sse",
  headers: "{}",
  isPublic: false,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ServerSharingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      mcpServers: [mockServer],
    });
  });

  it("renders sharing content without wrapping in a Card", () => {
    const { container } = render(<ServerSharingTab serverId="srv-1" />);

    expect(screen.getByText("Public Sharing")).toBeInTheDocument();
    expect(screen.getByText("Make this server public")).toBeInTheDocument();
    expect(screen.getByText("Important Note")).toBeInTheDocument();
    // Card component renders with class border and rounded-xl/rounded-lg shadow
    // Ensure no <div class="rounded-xl border ..."> Card container exists
    expect(container.querySelector(".rounded-xl.border")).toBeNull();
  });

  it("toggles server public status on switch change", async () => {
    vi.mocked(toggleMcpServerPublic).mockResolvedValue({
      id: "srv-1",
      userId: "user-1",
      name: "GitHub Tools",
      url: "https://mcp.github.com/sse",
      headers: "{}",
      isPublic: true,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    render(<ServerSharingTab serverId="srv-1" />);

    const switchBtn = screen.getByRole("switch", {
      name: /make this server public/i,
    });
    expect(switchBtn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(toggleMcpServerPublic).toHaveBeenCalledWith("srv-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Server is now public");
  });

  it("does not render when server is not found or is installed", () => {
    const { container: notFoundContainer } = render(
      <ServerSharingTab serverId="unknown" />,
    );
    expect(notFoundContainer).toBeEmptyDOMElement();

    useAppStore.setState({
      mcpServers: [{ ...mockServer, isInstalled: true }],
    });
    const { container: installedContainer } = render(
      <ServerSharingTab serverId="srv-1" />,
    );
    expect(installedContainer).toBeEmptyDOMElement();
  });
});

