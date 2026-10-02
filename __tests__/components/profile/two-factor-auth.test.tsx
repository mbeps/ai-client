import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TwoFactorAuth } from "@/app/profile/_components/security/two-factor-auth";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

const mockEnable = vi.fn();
const mockDisable = vi.fn();
const mockVerifyTotp = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    twoFactor: {
      enable: (payload: unknown) => mockEnable(payload),
      disable: (payload: unknown) => mockDisable(payload),
      verifyTotp: (payload: unknown, handlers: any) =>
        mockVerifyTotp(payload, handlers),
    },
  },
}));

const TOTP_DATA = {
  method: "totp",
  totpURI: "otpauth://totp/AI%20Chat%20Client:test@example.com?secret=ABC",
  backupCodes: ["code-one", "code-two"],
};

describe("TwoFactorAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reveals the TOTP QR panel after enabling 2FA", async () => {
    mockEnable.mockResolvedValue({ data: TOTP_DATA });

    render(<TwoFactorAuth isEnabled={false} />);

    await userEvent.type(screen.getByLabelText(/password/i), "CorrectHorse1");
    await userEvent.click(screen.getByRole("button", { name: /enable 2fa/i }));

    // The QR panel replaces the password form; before the fix it never appeared.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /submit code/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("ABC")).toBeInTheDocument();
  });

  it("reveals backup codes once the first TOTP code is verified", async () => {
    mockEnable.mockResolvedValue({ data: TOTP_DATA });
    mockVerifyTotp.mockImplementation((_payload: unknown, handlers: any) =>
      handlers.onSuccess({ data: { verified: true } }),
    );

    render(<TwoFactorAuth isEnabled={false} />);

    await userEvent.type(screen.getByLabelText(/password/i), "CorrectHorse1");
    await userEvent.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await userEvent.type(await screen.findByLabelText(/code/i), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: /submit code/i }),
    );

    await waitFor(() => expect(screen.getByText("code-one")).toBeVisible());
    expect(screen.getByText("code-two")).toBeVisible();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("keeps the password form and reports the error when enable fails", async () => {
    mockEnable.mockResolvedValue({ error: { message: "Invalid password" } });

    render(<TwoFactorAuth isEnabled={false} />);

    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /enable 2fa/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /submit code/i }),
    ).not.toBeInTheDocument();
  });
});