import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHeaders, mockListPasskeys, mockListUserAccounts, mockEnv } =
  vi.hoisted(() => ({
    mockHeaders: vi.fn(),
    mockListPasskeys: vi.fn(),
    mockListUserAccounts: vi.fn(),
    mockEnv: { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: true },
  }));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      listPasskeys: mockListPasskeys,
      listUserAccounts: mockListUserAccounts,
    },
  },
}));

vi.mock("@/app/profile/_components/security/change-password-form", () => ({
  ChangePasswordForm: () => <div data-testid="change-password-form" />,
}));

vi.mock("@/app/profile/_components/security/set-password-button", () => ({
  SetPasswordButton: ({ email }: { email: string }) => (
    <div data-testid="set-password-button">{email}</div>
  ),
}));

vi.mock("@/app/profile/_components/security/two-factor-auth", () => ({
  TwoFactorAuth: ({ isEnabled }: { isEnabled: boolean }) => (
    <div data-testid="two-factor-auth">{String(isEnabled)}</div>
  ),
}));

vi.mock("@/app/profile/_components/security/passkey-management", () => ({
  PasskeyManagement: ({ passkeys }: { passkeys: unknown[] }) => (
    <div data-testid="passkey-management">{passkeys.length}</div>
  ),
}));

import { SecurityTab } from "@/app/profile/_components/security/security-tab";

describe("SecurityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockListPasskeys.mockResolvedValue([]);
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = true;
  });

  it("renders ChangePasswordForm and TwoFactorAuth (Enabled) when user has credential account", async () => {
    mockListUserAccounts.mockResolvedValue([{ providerId: "credential" }]);

    const ui = await SecurityTab({
      email: "a@b.com",
      isTwoFactorEnabled: true,
    });
    render(ui);

    expect(screen.getByTestId("change-password-form")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByTestId("passkey-management")).toBeInTheDocument();
  });

  it("renders SetPasswordButton when user has no credential account", async () => {
    mockListUserAccounts.mockResolvedValue([{ providerId: "github" }]);

    const ui = await SecurityTab({
      email: "a@b.com",
      isTwoFactorEnabled: false,
    });
    render(ui);

    expect(screen.getByTestId("set-password-button")).toHaveTextContent(
      "a@b.com",
    );
    expect(screen.queryByTestId("two-factor-auth")).not.toBeInTheDocument();
  });

  it("renders Disabled badge when 2FA is false and hides password/2FA when flag is false", async () => {
    mockListUserAccounts.mockResolvedValue([{ providerId: "credential" }]);

    const ui1 = await SecurityTab({
      email: "a@b.com",
      isTwoFactorEnabled: false,
    });
    const { unmount } = render(ui1);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    unmount();

    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = false;
    const ui2 = await SecurityTab({
      email: "a@b.com",
      isTwoFactorEnabled: false,
    });
    render(ui2);
    expect(screen.queryByTestId("change-password-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("two-factor-auth")).not.toBeInTheDocument();
    expect(screen.getByTestId("passkey-management")).toBeInTheDocument();
  });
});
