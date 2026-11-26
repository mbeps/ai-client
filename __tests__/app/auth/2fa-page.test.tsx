import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockHeaders, mockRedirect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockHeaders: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/app/auth/2fa/_components/totp-form", () => ({
  TotpForm: () => <div data-testid="totp-form" />,
}));

vi.mock("@/app/auth/2fa/_components/backup-code-tab", () => ({
  BackupCodeTab: () => <div data-testid="backup-code-tab" />,
}));

import TwoFactorPage from "@/app/auth/2fa/page";

describe("TwoFactorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it("redirects to home when session exists", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });

    await TwoFactorPage();

    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("renders 2FA tabs when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);

    const ui = await TwoFactorPage();
    render(ui);

    expect(screen.getByText("Two-Factor Authentication")).toBeInTheDocument();
    expect(screen.getByTestId("totp-form")).toBeInTheDocument();
  });
});
