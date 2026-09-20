import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const revalidatePathMock = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

const chainable = vi.hoisted(() => {
  const c: any = {};
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "onConflictDoUpdate",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.returning = vi.fn().mockResolvedValue([]);
  c.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

import { ROUTES } from "@/config/routes";
import { getUserSettings } from "@/actions/user-settings/get-user-settings";
import { updateUserSettings } from "@/actions/user-settings/update-user-settings";

describe("user settings actions", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      user: { id: userId, email: "test@example.com" },
      session: { id: "sess-1" },
    });
    for (const m of [
      "select",
      "from",
      "where",
      "insert",
      "values",
      "onConflictDoUpdate",
    ]) {
      chainable[m].mockImplementation(() => chainable);
    }
    chainable.returning.mockResolvedValue([]);
    chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  });

  describe("getUserSettings", () => {
    it("returns null when no settings row exists for user", async () => {
      chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

      const result = await getUserSettings();
      expect(result).toBeNull();
    });

    it("returns settings row when found", async () => {
      const mockSettings = {
        id: "settings-1",
        userId,
        globalSystemPrompt: "You are a helpful assistant.",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      chainable.then = (onFulfilled: any) => Promise.resolve([mockSettings]).then(onFulfilled);

      const result = await getUserSettings();
      expect(result).toEqual(mockSettings);
    });
  });

  describe("updateUserSettings", () => {
    it("upserts settings with provided globalSystemPrompt and calls revalidatePath", async () => {
      const updatedRow = {
        id: "settings-1",
        userId,
        globalSystemPrompt: "Custom prompt",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      chainable.returning.mockResolvedValueOnce([updatedRow]);

      const result = await updateUserSettings({
        globalSystemPrompt: "Custom prompt",
      });

      expect(result).toEqual(updatedRow);
      expect(chainable.insert).toHaveBeenCalled();
      expect(chainable.onConflictDoUpdate).toHaveBeenCalled();
      expect(revalidatePathMock).toHaveBeenCalledWith(ROUTES.SETTINGS.APP.path);
    });

    it("upserts settings with null when globalSystemPrompt is not provided", async () => {
      const updatedRow = {
        id: "settings-1",
        userId,
        globalSystemPrompt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      chainable.returning.mockResolvedValueOnce([updatedRow]);

      const result = await updateUserSettings({});

      expect(result).toEqual(updatedRow);
      expect(chainable.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          globalSystemPrompt: null,
        }),
      );
    });
  });
});

