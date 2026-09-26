import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom doesn't implement ResizeObserver (used by Radix UI components)
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ─── Hoisted Mocks ─────────────────────────────────────────────────────────
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
let currentParamId = "server-1";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: currentParamId }),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  notFound: () => mockNotFound(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn((_key, _options) => ["tools", vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Safety-Net Mocks ──────────────────────────────────────────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/auth/auth", () => ({ auth: {} }));

// ─── Action Mocks ──────────────────────────────────────────────────────────
vi.mock("@/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));
vi.mock("@/actions/mcp-servers/toggle-mcp-server", () => ({
  toggleMcpServer: vi.fn(),
}));

// ─── Component Mocks ───────────────────────────────────────────────────────
vi.mock("@/components/mcp/tool-list", () => ({
  ToolList: () => <div data-testid="tool-list">ToolList</div>,
}));
vi.mock("@/components/mcp/resource-list", () => ({
  ResourceList: () => <div data-testid="resource-list">ResourceList</div>,
}));
vi.mock("@/components/mcp/edit-server-form", () => ({
  EditServerForm: () => <div data-testid="edit-server-form">EditServerForm</div>,
}));
vi.mock("@/components/mcp/server-settings", () => ({
  ServerSettings: () => <div data-testid="server-settings">ServerSettings</div>,
}));

import React from "react";
import { listMcpServers } from "@/actions/mcp-servers/list-mcp-servers";
import McpServerPage from "@/app/settings/tools/[id]/page";
import { useAppStore } from "@/lib/store";
import type { McpServer } from "@/types/mcp/mcp-server";

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">{this.state.error?.message}</div>
      );
    }
    return this.props.children;
  }
}

const mockServer: McpServer = {
  id: "server-1",
  userId: "user-1",
  name: "GitHub Tools",
  url: "https://mcp.github.com/sse",
  headers: "{}",
  isPublic: false,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("McpServerPage (Tools Detail Page)", () => {
  beforeEach(() => {
    currentParamId = "server-1";
    useAppStore.setState({
      chats: {},
      projects: [],
      assistants: [],
      prompts: [],
      skills: [],
      knowledgebases: [],
      mcpServers: [],
      publicMcpServers: [],
    });
    vi.clearAllMocks();
  });

  it("renders loading spinner on initial mount when mcpServers is empty and calls loadMcpServers", () => {
    // Keep listMcpServers pending so loading state remains active
    vi.mocked(listMcpServers).mockReturnValue(new Promise(() => {}));

    const { container } = render(<McpServerPage />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(listMcpServers).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("GitHub Tools")).not.toBeInTheDocument();
  });

  it("renders server details once mcpServers are loaded", () => {
    useAppStore.setState({
      mcpServers: [mockServer],
    });

    render(<McpServerPage />);

    expect(screen.getByText("GitHub Tools")).toBeInTheDocument();
    expect(screen.getByText("Back to Tools")).toBeInTheDocument();
    expect(screen.getByTestId("tool-list")).toBeInTheDocument();
  });

  it("triggers notFound() when server is not found in non-empty mcpServers", () => {
    useAppStore.setState({
      mcpServers: [{ ...mockServer, id: "other-server" }],
    });

    expect(() => render(<McpServerPage />)).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("triggers notFound() when loadMcpServers completes and server is not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listMcpServers).mockResolvedValue([]);

    render(
      <TestErrorBoundary>
        <McpServerPage />
      </TestErrorBoundary>,
    );

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled();
    });
    expect(screen.getByTestId("error-boundary")).toHaveTextContent(
      "NEXT_NOT_FOUND",
    );

    consoleSpy.mockRestore();
  });
});
