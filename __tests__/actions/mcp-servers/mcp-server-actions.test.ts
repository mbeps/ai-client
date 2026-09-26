import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock env
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

// Mock URL guard
vi.mock("@/lib/mcp/url-guard/is-blocked-url-sync", () => ({
  isBlockedUrlSync: vi.fn().mockReturnValue(false),
}));

// Setup chainable DB mock
const chainable = vi.hoisted(() => {
  const c: any = {};
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.returning = vi.fn().mockResolvedValue([]);
  // Enable awaiting chainable directly for queries without .returning()
  c.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

import { createMcpServer } from "@/actions/mcp-servers/create-mcp-server";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { renameMcpServer } from "@/actions/mcp-servers/rename-mcp-server";
import { toggleMcpServer } from "@/actions/mcp-servers/toggle-mcp-server";
import { updateMcpServer } from "@/actions/mcp-servers/update-mcp-server";

describe("mcp server personal actions", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      user: { id: userId, name: "Test", email: "test@example.com" },
      session: { id: "sess-1" },
    });
    for (const m of [
      "select",
      "from",
      "where",
      "insert",
      "values",
      "update",
      "set",
      "delete",
    ]) {
      chainable[m].mockImplementation(() => chainable);
    }
    chainable.returning.mockResolvedValue([]);
    chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  });

  describe("createMcpServer", () => {
    it("creates a new MCP server with mapped config and returns row", async () => {
      const inserted = {
        id: "srv-new",
        name: "My Server",
        url: "https://example.com/mcp",
        headers: '{"auth":"token"}',
        isPublic: false,
        userId,
      };
      chainable.returning.mockResolvedValueOnce([inserted]);

      const result = await createMcpServer({
        name: "My Server",
        url: "https://example.com/mcp",
        headers: '{"auth":"token"}',
        isPublic: false,
      });

      expect(result).toEqual(inserted);
      expect(chainable.insert).toHaveBeenCalled();
    });
  });

  describe("deleteMcpServer", () => {
    it("returns 0 deleted count immediately for empty array", async () => {
      const result = await deleteMcpServer([]);
      expect(result).toEqual({ deletedCount: 0 });
    });

    it("deletes personal owned server", async () => {
      chainable.returning
        .mockResolvedValueOnce([{ id: "srv-1" }]) // personal delete
        .mockResolvedValueOnce([]); // install delete

      const result = await deleteMcpServer("srv-1");
      expect(result).toEqual({ deletedCount: 1 });
    });

    it("deletes installed community server when personal yields none", async () => {
      chainable.returning
        .mockResolvedValueOnce([]) // personal delete
        .mockResolvedValueOnce([{ id: "inst-1" }]); // install delete

      const result = await deleteMcpServer("inst-1");
      expect(result).toEqual({ deletedCount: 1 });
    });

    it("throws Not Found when neither personal nor installed matches", async () => {
      chainable.returning
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await expect(deleteMcpServer("missing-id")).rejects.toThrow("Not Found");
    });
  });

  describe("renameMcpServer", () => {
    it("renames MCP server", async () => {
      const updated = { id: "srv-1", name: "Renamed Server" };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await renameMcpServer("srv-1", "Renamed Server");
      expect(result).toEqual(updated);
    });
  });

  describe("toggleMcpServer", () => {
    it("toggles personal server when owned by user", async () => {
      const toggled = { id: "srv-1", enabled: false };
      chainable.returning.mockResolvedValueOnce([toggled]);

      const result = await toggleMcpServer("srv-1");
      expect(result).toEqual({ ...toggled, isInstalled: false });
    });

    it("toggles installed community server and fetches source server info", async () => {
      const toggledInstall = {
        id: "inst-1",
        serverId: "src-1",
        headers: '{"tok":"sub"}',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const sourceServer = {
        id: "src-1",
        userId: "author-user",
        name: "Community Tool",
        url: "https://example.com/community",
      };

      chainable.returning
        .mockResolvedValueOnce([]) // personal update
        .mockResolvedValueOnce([toggledInstall]); // install update

      chainable.then = (onFulfilled: any) => Promise.resolve([sourceServer]).then(onFulfilled);

      const result = await toggleMcpServer("inst-1");
      expect(result).toMatchObject({
        id: "src-1",
        name: "Community Tool",
        enabled: true,
        isInstalled: true,
        installId: "inst-1",
      });
    });

    it("throws Not Found when neither personal nor install row matches", async () => {
      chainable.returning
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await expect(toggleMcpServer("unknown-id")).rejects.toThrow("Not Found");
    });

    it("throws Not Found when install row exists but underlying server is missing", async () => {
      const toggledInstall = {
        id: "inst-1",
        serverId: "src-missing",
      };
      chainable.returning
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([toggledInstall]);

      chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

      await expect(toggleMcpServer("inst-1")).rejects.toThrow("Not Found");
    });
  });

  describe("updateMcpServer", () => {
    it("updates MCP server with new config", async () => {
      const updated = {
        id: "srv-1",
        name: "Updated",
        url: "https://example.com/new",
        headers: '{"auth":"new"}',
        isPublic: true,
      };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateMcpServer("srv-1", {
        name: "Updated",
        url: "https://example.com/new",
        headers: '{"auth":"new"}',
        isPublic: true,
      });

      expect(result).toEqual(updated);
    });

    it("preserves headers when headers is empty string", async () => {
      const updated = {
        id: "srv-1",
        name: "Updated",
        url: "https://example.com/new",
        isPublic: false,
      };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateMcpServer("srv-1", {
        name: "Updated",
        url: "https://example.com/new",
        headers: "",
        isPublic: false,
      });

      expect(result).toEqual(updated);
      expect(chainable.set).toHaveBeenCalledWith(
        expect.not.objectContaining({ headers: expect.anything() }),
      );
    });

    it("throws Not Found when update returns empty array", async () => {
      chainable.returning.mockResolvedValueOnce([]);

      await expect(
        updateMcpServer("missing-id", {
          name: "Missing",
          url: "https://example.com/mcp",
          isPublic: false,
        }),
      ).rejects.toThrow("Not Found");
    });
  });
});

