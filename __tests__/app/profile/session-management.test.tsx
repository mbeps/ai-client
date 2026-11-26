import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockRevokeOtherSessions, mockRevokeSession } = vi.hoisted(
  () => ({
    mockRefresh: vi.fn(),
    mockRevokeOtherSessions: vi.fn(),
    mockRevokeSession: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    revokeOtherSessions: mockRevokeOtherSessions,
    revokeSession: mockRevokeSession,
  },
}));

vi.mock("@/components/auth/buttons/better-auth-action-button", () => ({
  BetterAuthActionButton: ({
    action,
    children,
  }: {
    action: () => Promise<unknown>;
    children: React.ReactNode;
  }) => (
    <button type="button" onClick={() => void action()}>
      {children}
    </button>
  ),
}));

import { SessionManagement } from "@/app/profile/_components/session/session-management";

const baseSession = {
  id: "s1",
  token: "cur-tok",
  userId: "u1",
  createdAt: new Date("2025-01-01T10:00:00Z"),
  updatedAt: new Date("2025-01-01T10:00:00Z"),
  expiresAt: new Date("2025-02-01T10:00:00Z"),
  ipAddress: "127.0.0.1",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

describe("SessionManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokeOtherSessions.mockImplementation(async (_arg, opts) => {
      opts?.onSuccess?.();
      return { error: null };
    });
    mockRevokeSession.mockImplementation(async (_arg, opts) => {
      opts?.onSuccess?.();
      return { error: null };
    });
  });

  it("renders current session and empty other sessions state", () => {
    render(
      <SessionManagement
        sessions={[baseSession]}
        currentSessionToken="cur-tok"
      />,
    );

    expect(screen.getByText("Current Session")).toBeInTheDocument();
    expect(screen.getByText("No other active sessions")).toBeInTheDocument();
    expect(screen.getByText("Chrome, Windows")).toBeInTheDocument();
  });

  it("handles various userAgent formats and revokes individual and other sessions", async () => {
    const user = userEvent.setup();
    render(
      <SessionManagement
        currentSessionToken="cur-tok"
        sessions={[
          { ...baseSession, id: "s-none", token: "t1", userAgent: null },
          { ...baseSession, id: "s-unparsed", token: "t2", userAgent: "curl/8.0" },
          {
            ...baseSession,
            id: "s-mobile",
            token: "t3",
            userAgent:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
          },
          {
            ...baseSession,
            id: "s-browser-only",
            token: "t4",
            userAgent: "Chrome/120.0.0.0",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Unknown Device").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/iOS/)).toBeInTheDocument();
    expect(screen.getByText(/Chrome/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /revoke other sessions/i }),
    );
    await waitFor(() => {
      expect(mockRevokeOtherSessions).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    const buttons = screen.getAllByRole("button");
    // Click the first individual revoke button (after "Revoke Other Sessions")
    await user.click(buttons[1]);
    await waitFor(() => {
      expect(mockRevokeSession).toHaveBeenCalledWith(
        { token: "t1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

  });

  it("renders OS name when userAgent has OS but no browser", () => {
    const osOnlySession = {
      ...baseSession,
      id: "s-os",
      userAgent: "Linux x86_64",
    };
    render(
      <SessionManagement
        sessions={[osOnlySession]}
        currentSessionToken="other"
      />,
    );
    expect(screen.getByText("Linux")).toBeInTheDocument();
  });
});
