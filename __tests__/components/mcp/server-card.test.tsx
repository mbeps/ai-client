import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { toggleMcpServer } from "@/actions/mcp-servers/toggle-mcp-server";
import { ServerCard } from "@/components/mcp/server-card";
import type { McpServer } from "@/types/mcp/mcp-server";

const mockLoadMcpServers = vi.hoisted(() => vi.fn(async () => {}));
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/actions/mcp-servers/toggle-mcp-server", () => ({
  toggleMcpServer: vi.fn(),
}));
vi.mock("@/actions/mcp-servers/delete-mcp-server", () => ({
  deleteMcpServer: vi.fn(),
}));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) =>
    selector({ loadMcpServers: mockLoadMcpServers }),
  ),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

const baseServer: McpServer = {
  id: "srv-1",
  userId: "user-1",
  name: "My Server",
  url: "https://example.com/mcp",
  enabled: true,
  authType: "oauth",
  oauthConnected: true,
  isInstalled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as McpServer;

describe("ServerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles server enabled/disabled and handles errors", async () => {
    vi.mocked(toggleMcpServer)
      .mockResolvedValueOnce({ ok: true, value: baseServer })
      .mockResolvedValueOnce({ ok: true, value: baseServer })
      .mockResolvedValueOnce({ ok: false, error: { message: "Toggle err" } as any })
      .mockResolvedValueOnce({ ok: false, error: { message: "" } as any })
      .mockRejectedValueOnce(new Error("boom"));

    const { rerender } = render(<ServerCard server={baseServer} />);
    expect(screen.getByText("OAuth Connected")).toBeInTheDocument();

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Server disabled"));

    rerender(<ServerCard server={{ ...baseServer, enabled: false }} />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Server enabled"));

    fireEvent.click(toggle);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Toggle err"));

    fireEvent.click(toggle);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Failed to toggle server"));

    fireEvent.click(toggle);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Failed to toggle server"));
  });

  it("deletes custom and installed servers and handles errors", async () => {
    vi.mocked(deleteMcpServer)
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: false, error: { message: "" } as any })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: false, error: { message: "" } as any })
      .mockRejectedValueOnce(new Error("boom"));

    const { rerender } = render(<ServerCard server={baseServer} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Server deleted"));

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete server"),
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete server"),
    );

    rerender(
      <ServerCard
        server={{ ...baseServer, isInstalled: true, oauthConnected: false }}
      />,
    );
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("OAuth")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));
    fireEvent.click(screen.getByRole("button", { name: /^uninstall$/i }));
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Tool uninstalled"),
    );

    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));
    fireEvent.click(screen.getByRole("button", { name: /^uninstall$/i }));
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to uninstall tool"),
    );

    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));
    fireEvent.click(screen.getByRole("button", { name: /^uninstall$/i }));
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to uninstall tool"),
    );
  });
});
