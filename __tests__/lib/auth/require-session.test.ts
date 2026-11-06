import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { requireSession } from "@/lib/auth/require-session";

describe("requireSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
  });

  it("returns the session when user is authenticated", async () => {
    const mockSession = {
      user: { id: "user-123", email: "user@example.com" },
      session: { id: "session-456" },
    };
    getSessionMock.mockResolvedValueOnce(mockSession);

    const result = await requireSession();
    expect(result).toBe(mockSession);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("throws Unauthorized AppException when session is null", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(requireSession()).rejects.toThrow("Unauthorized");
    getSessionMock.mockResolvedValueOnce(null);
    try {
      await requireSession();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).error.code).toBe(ERROR_CODE.UNAUTHORIZED);
    }
  });
});

