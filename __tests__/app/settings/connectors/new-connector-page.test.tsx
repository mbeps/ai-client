import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const { mockPush, mockLoadMcpServers, mockCreateMcpServer, mockToast } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockLoadMcpServers: vi.fn(),
  mockCreateMcpServer: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn(() => ["manual", vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/actions/mcp-servers/create-mcp-server", () => ({
  createMcpServer: mockCreateMcpServer,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({ loadMcpServers: mockLoadMcpServers }),
}));

vi.mock("@/components/mcp/server-form-fields", () => ({
  ServerFormFields: ({ form }: { form: any }) => (
    <div data-testid="server-form-fields">
      <input aria-label="Server Name" {...form.register("name")} />
      <input aria-label="Server URL" {...form.register("url")} />
    </div>
  ),
}));

vi.mock("@/components/mcp/public-server-discovery", () => ({
  PublicServerDiscovery: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess}>
      Trigger Discovery Success
    </button>
  ),
}));

import { useQueryState } from "nuqs";
import NewMcpServerPage from "@/app/settings/connectors/new/page";

describe("NewMcpServerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryState).mockReturnValue(["manual", vi.fn()] as any);
    mockLoadMcpServers.mockResolvedValue(undefined);
  });

  function fillAndSubmit() {
    fireEvent.change(screen.getByLabelText("Server Name"), {
      target: { value: "My MCP" },
    });
    fireEvent.change(screen.getByLabelText("Server URL"), {
      target: { value: "https://example.com/mcp" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add server/i }));
  }

  it("submits form, reloads servers, and redirects on success", async () => {
    mockCreateMcpServer.mockResolvedValue({ ok: true, value: { id: "srv-1" } });
    render(<NewMcpServerPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(mockCreateMcpServer).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("MCP server added");
      expect(mockLoadMcpServers).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.CONNECTORS.path);
    });
  });

  it("shows error toast when createMcpServer returns !ok with message and fallback", async () => {
    mockCreateMcpServer.mockResolvedValueOnce({
      ok: false,
      error: { message: "Duplicate URL" },
    });
    render(<NewMcpServerPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Duplicate URL");
    });

    mockCreateMcpServer.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fillAndSubmit();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to add MCP server");
    });
  });

  it("shows error toast when createMcpServer throws Error or non-Error", async () => {
    mockCreateMcpServer.mockRejectedValueOnce(new Error("Network error"));
    render(<NewMcpServerPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Network error");
    });

    mockCreateMcpServer.mockRejectedValueOnce("unexpected");
    fillAndSubmit();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to add MCP server");
    });
  });

  it("navigates to connectors list when PublicServerDiscovery calls onSuccess", () => {
    vi.mocked(useQueryState).mockReturnValue(["discover", vi.fn()] as any);
    render(<NewMcpServerPage />);

    fireEvent.click(screen.getByRole("button", { name: "Trigger Discovery Success" }));
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.CONNECTORS.path);
  });
});
