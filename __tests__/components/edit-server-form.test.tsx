import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { updateInstalledServerHeaders } from "@/actions/mcp-servers/update-installed-server-headers";
import { updateMcpServer } from "@/actions/mcp-servers/update-mcp-server";
import { EditServerForm } from "@/components/mcp/edit-server-form";
import type { McpServer } from "@/types/mcp/mcp-server";

// jsdom doesn't implement ResizeObserver (used by Radix UI components)
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ─── Hoisted mock variables ────────────────────────────────────────────────
const mockRefresh = vi.hoisted(() => vi.fn());
const mockLoadMcpServers = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ refresh: mockRefresh }),
}));

vi.mock("@/actions/mcp-servers/update-mcp-server", () => ({
  updateMcpServer: vi.fn(),
}));

vi.mock(
  "@/actions/mcp-servers/update-installed-server-headers",
  () => ({
    updateInstalledServerHeaders: vi.fn(),
  }),
);

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      loadMcpServers: mockLoadMcpServers,
    }),
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Fixture ───────────────────────────────────────────────────────────────
const serverWithAuthHeader: McpServer = {
  id: "srv-1",
  userId: "user-1",
  name: "Test Server",
  url: "https://mcp.example.com/sse",
  headers: '{"Authorization": "Bearer secret-token"}',
  isPublic: false,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("EditServerForm — header masking (SEC-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose saved auth token in the DOM", () => {
    render(<EditServerForm server={serverWithAuthHeader} />);
    expect(screen.queryByText(/secret-token/)).toBeNull();
  });

  it("renders the headers textarea as empty", () => {
    render(<EditServerForm server={serverWithAuthHeader} />);
    // Placeholder is the "saved" hint since server has headers
    const textarea = screen.getByPlaceholderText(
      /Saved — enter new value to update/,
    );
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });
});

describe("EditServerForm — submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits installed server by updating headers and reloading store", async () => {
    const installedServer: McpServer = {
      ...serverWithAuthHeader,
      isInstalled: true,
      installId: "inst-1",
    };
    render(<EditServerForm server={installedServer} />);
    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateInstalledServerHeaders).toHaveBeenCalledWith("srv-1", "");
      expect(updateMcpServer).not.toHaveBeenCalled();
      expect(mockLoadMcpServers).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("submits owned server by calling updateMcpServer and reloading store", async () => {
    const ownedServer: McpServer = {
      ...serverWithAuthHeader,
      isInstalled: false,
    };
    render(<EditServerForm server={ownedServer} />);
    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateMcpServer).toHaveBeenCalledWith("srv-1", {
        name: "Test Server",
        url: "https://mcp.example.com/sse",
        headers: "",
        isPublic: false,
      });
      expect(updateInstalledServerHeaders).not.toHaveBeenCalled();
      expect(mockLoadMcpServers).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
