import { render, screen } from "@testing-library/react";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionsTab } from "@/app/profile/_components/session/sessions-tab";
import { ROUTES } from "@/config/routes";

const mockHeaders = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

const mockRedirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const mockListSessions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      listSessions: mockListSessions,
    },
  },
}));

const mockDbWhere = vi.hoisted(() => vi.fn());
const mockDbFrom = vi.hoisted(() => vi.fn(() => ({ where: mockDbWhere })));
const mockDbSelect = vi.hoisted(() => vi.fn(() => ({ from: mockDbFrom })));
vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockDbSelect,
  },
}));

const mockSession = {
  id: "sess-1",
  userId: "user-1",
  token: "token-current",
  createdAt: new Date("2026-11-20T10:00:00.000Z"),
  updatedAt: new Date("2026-11-20T10:00:00.000Z"),
  expiresAt: new Date("2026-11-27T10:00:00.000Z"),
  userAgent: "Mozilla/5.0 Chrome/158.0.0.0",
  ipAddress: "127.0.0.1",
};

describe("SessionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it("renders sessions returned by auth.api.listSessions", async () => {
    mockListSessions.mockResolvedValue([mockSession]);

    const ui = await SessionsTab({
      currentSessionToken: "token-current",
      userId: "user-1",
    });
    render(ui);

    expect(screen.getByText("Current Session")).toBeInTheDocument();
    expect(screen.getByText("No other active sessions")).toBeInTheDocument();
  });

  it("falls back to active DB sessions when listSessions throws SESSION_NOT_FRESH", async () => {
    mockListSessions.mockRejectedValue(
      APIError.from("FORBIDDEN", {
        code: "SESSION_NOT_FRESH",
        message: "Session is not fresh",
      }),
    );
    mockDbWhere.mockResolvedValue([mockSession]);

    const ui = await SessionsTab({
      currentSessionToken: "token-current",
      userId: "user-1",
    });
    render(ui);

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Current Session")).toBeInTheDocument();
    expect(screen.getByText("No other active sessions")).toBeInTheDocument();
  });

  it("redirects to login when listSessions throws UNAUTHORIZED", async () => {
    mockListSessions.mockRejectedValue(
      APIError.from("UNAUTHORIZED", {
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      }),
    );

    await expect(
      SessionsTab({
        currentSessionToken: "token-current",
        userId: "user-1",
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.AUTH.LOGIN.path}`);
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN.path);
  });

  it("rethrows unexpected non-auth errors", async () => {
    mockListSessions.mockRejectedValue(new Error("Unexpected DB error"));

    await expect(
      SessionsTab({
        currentSessionToken: "token-current",
        userId: "user-1",
      }),
    ).rejects.toThrow("Unexpected DB error");
  });
});
