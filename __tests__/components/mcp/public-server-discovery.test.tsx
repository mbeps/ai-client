import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPublicServer } from "@/actions/mcp-servers/add-public-server";
import { PublicServerDiscovery } from "@/components/mcp/public-server-discovery";
import { useAppStore } from "@/lib/store/use-app-store";

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/actions/mcp-servers/add-public-server", () => ({
  addPublicServer: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

const pub1 = {
  id: "pub-1",
  name: "Weather Server",
  url: "https://weather.example.com/mcp",
  isInstalled: false,
} as any;

const pub2 = {
  id: "pub-2",
  name: "GitHub Server",
  url: "https://github.example.com/mcp",
  isInstalled: true,
} as any;

const pub3 = {
  id: "pub-3",
  name: "Local Match",
  url: "https://local.example.com/mcp",
  isInstalled: false,
} as any;

describe("PublicServerDiscovery", () => {
  const mockLoadPublicMcpServers = vi.fn(async () => {});
  const mockLoadMcpServers = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      publicMcpServers: [pub1, pub2, pub3],
      mcpServers: [{ id: "pub-3", name: "Local Match" } as any],
      loadPublicMcpServers: mockLoadPublicMcpServers,
      loadMcpServers: mockLoadMcpServers,
    });
  });

  it("loads public servers, filters by search, clears search, and shows installed state", async () => {
    render(<PublicServerDiscovery />);

    await waitFor(() => expect(mockLoadPublicMcpServers).toHaveBeenCalled());

    expect(screen.getByText("Weather Server")).toBeInTheDocument();
    expect(screen.getByText("GitHub Server")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /installed/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /install$/i })).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search public servers...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByText("No public servers found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getByText("Weather Server")).toBeInTheDocument();
  });

  it("handles installing a public server: success, error responses, and exceptions", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    vi.mocked(addPublicServer)
      .mockResolvedValueOnce({ ok: false, error: { message: "Add err" } } as any)
      .mockResolvedValueOnce({ ok: false, error: { message: "" } } as any)
      .mockRejectedValueOnce(new Error("Network boom"))
      .mockRejectedValueOnce("non-error")
      .mockResolvedValueOnce({ ok: true, value: pub1 } as any);

    render(<PublicServerDiscovery onSuccess={onSuccess} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Weather Server")).toBeInTheDocument());

    const installBtn = () => screen.getByRole("button", { name: /install$/i });

    fireEvent.click(installBtn());
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Add err"));

    fireEvent.click(installBtn());
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to add server"),
    );

    fireEvent.click(installBtn());
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Network boom"));

    fireEvent.click(installBtn());
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to add server"),
    );

    fireEvent.click(installBtn());
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Succesfully added "Weather Server"');
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
