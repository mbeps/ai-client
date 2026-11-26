import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectMcpOAuth } from "@/actions/mcp-servers/disconnect-mcp-oauth";
import { initiateMcpOAuth } from "@/actions/mcp-servers/initiate-mcp-oauth";
import { updateInstalledServerHeaders } from "@/actions/mcp-servers/update-installed-server-headers";
import { updateMcpServer } from "@/actions/mcp-servers/update-mcp-server";
import { EditServerForm } from "@/components/mcp/edit-server-form";
import type { McpServer } from "@/types/mcp/mcp-server";

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockLoadMcpServers = vi.hoisted(() => vi.fn(async () => {}));
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
vi.mock("@/actions/mcp-servers/initiate-mcp-oauth", () => ({
  initiateMcpOAuth: vi.fn(),
}));
vi.mock("@/actions/mcp-servers/disconnect-mcp-oauth", () => ({
  disconnectMcpOAuth: vi.fn(),
}));
vi.mock("@/actions/mcp-servers/update-installed-server-headers", () => ({
  updateInstalledServerHeaders: vi.fn(),
}));
vi.mock("@/actions/mcp-servers/update-mcp-server", () => ({
  updateMcpServer: vi.fn(),
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
  headers: "",
  isPublic: false,
  isInstalled: false,
  enabled: true,
  authType: "oauth",
  oauthConnected: false,
  oauthClientId: "client-1",
  oauthScope: "read",
  createdAt: new Date(),
  updatedAt: new Date(),
} as McpServer;

describe("EditServerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles OAuth connect: error, alreadyAuthorized, authorizationUrl, and exception", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });

    vi.mocked(initiateMcpOAuth)
      .mockResolvedValueOnce({ ok: false, error: { message: "OAuth err" } } as any)
      .mockResolvedValueOnce({ ok: false, error: { message: "" } } as any)
      .mockResolvedValueOnce({ ok: true, value: { alreadyAuthorized: true } } as any)
      .mockResolvedValueOnce({
        ok: true,
        value: { alreadyAuthorized: false, authorizationUrl: "https://auth.example.com" },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        value: { alreadyAuthorized: false },
      } as any)
      .mockRejectedValueOnce(new Error("boom"));

    render(<EditServerForm server={baseServer} />);
    const connectBtn = screen.getByRole("button", { name: /connect/i });

    fireEvent.click(connectBtn);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("OAuth err"));

    fireEvent.click(connectBtn);
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to initiate OAuth"),
    );

    fireEvent.click(connectBtn);
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("OAuth already authorized"),
    );

    fireEvent.click(connectBtn);
    await waitFor(() =>
      expect(window.location.href).toBe("https://auth.example.com"),
    );

    fireEvent.click(connectBtn);
    await waitFor(() => expect(initiateMcpOAuth).toHaveBeenCalledTimes(5));

    fireEvent.click(connectBtn);
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        "Failed to initiate OAuth authorization",
      ),
    );

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("handles OAuth disconnect: error, success, and exception", async () => {
    vi.mocked(disconnectMcpOAuth)
      .mockResolvedValueOnce({ ok: false, error: { message: "Disc err" } } as any)
      .mockResolvedValueOnce({ ok: false, error: { message: "" } } as any)
      .mockResolvedValueOnce({ ok: true, value: undefined } as any)
      .mockRejectedValueOnce(new Error("boom"));

    render(<EditServerForm server={{ ...baseServer, oauthConnected: true }} />);
    const disconnectBtn = screen.getByRole("button", { name: /disconnect/i });

    fireEvent.click(disconnectBtn);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Disc err"));

    fireEvent.click(disconnectBtn);
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to disconnect OAuth"),
    );

    fireEvent.click(disconnectBtn);
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("OAuth disconnected"),
    );

    fireEvent.click(disconnectBtn);
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to disconnect OAuth"),
    );
  });

  it("handles form submit for installed and custom servers including errors", async () => {
    vi.mocked(updateInstalledServerHeaders)
      .mockResolvedValueOnce({ ok: false, error: { message: "Hdr err" } } as any)
      .mockResolvedValueOnce({ ok: false, error: { message: "" } } as any)
      .mockResolvedValueOnce({ ok: true, value: baseServer } as any)
      .mockRejectedValueOnce(new Error("boom"));

    const { unmount } = render(
      <EditServerForm server={{ ...baseServer, isInstalled: true, headers: "{}" }} />,
    );
    const submitBtn = () => screen.getByRole("button", { name: /save/i });

    fireEvent.click(submitBtn());
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Hdr err"));

    fireEvent.click(submitBtn());
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update headers"),
    );

    fireEvent.click(submitBtn());
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Custom headers updated"),
    );

    fireEvent.click(submitBtn());
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update headers"),
    );

    vi.mocked(updateMcpServer)
      .mockResolvedValueOnce({ ok: false, error: { message: "Srv err" } } as any)
      .mockResolvedValueOnce({ ok: false, error: { message: "" } } as any)
      .mockResolvedValueOnce({ ok: true, value: baseServer } as any)
      .mockRejectedValueOnce(new Error("boom"));

    unmount();
    render(
      <EditServerForm
        server={{ ...baseServer, authType: "none" as any, headers: "", isInstalled: false }}
      />,
    );

    const submitForm = () => fireEvent.submit(document.querySelector("form")!);

    submitForm();
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Srv err"));

    submitForm();
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update server"),
    );

    submitForm();
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Server configuration updated"),
    );

    submitForm();
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update server"),
    );

    render(
      <EditServerForm
        server={{
          ...baseServer,
          url: undefined as any,
          authType: undefined as any,
          headers: undefined as any,
        }}
      />,
    );
  });

  it("switches authType tab to No Auth and clears headers", async () => {
    render(<EditServerForm server={baseServer} />);
    const noAuthTab = screen.getByRole("tab", { name: /No Auth/i });
    fireEvent.mouseDown(noAuthTab);
    fireEvent.click(noAuthTab);
    expect(noAuthTab).toHaveAttribute("data-state", "active");
  });

  it("handles headers not pre-populated (SEC-07) and installed oauth undefined fields", () => {
    render(
      <EditServerForm
        server={{
          ...baseServer,
          authType: "headers",
          headers: JSON.stringify({ "api-key": "secret-123" }),
        }}
      />,
    );

    const headersInput = screen.getByPlaceholderText("Saved — enter new value to update");
    expect(headersInput).toHaveValue("");
    fireEvent.change(headersInput, { target: { value: '{"Authorization":"Bearer my-token"}' } });
    expect(headersInput).toHaveValue('{"Authorization":"Bearer my-token"}');

    render(
      <EditServerForm
        server={{
          ...baseServer,
          isInstalled: true,
          authType: "oauth",
          oauthClientId: undefined as any,
          oauthClientSecret: undefined as any,
          oauthScope: undefined as any,
        }}
      />,
    );
    expect(
      screen.getAllByRole("tab", { name: /OAuth/i }).at(-1),
    ).toHaveAttribute("data-state", "active");
  });
});
