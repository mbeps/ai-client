import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
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

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ refresh: mockRefresh }),
}));

vi.mock("@/lib/actions/mcp-servers/update-mcp-server", () => ({
  updateMcpServer: vi.fn(),
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
