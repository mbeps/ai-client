import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRefresh,
  mockEnable,
  mockDisable,
  mockVerifyTotp,
  mockToastError,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockEnable: vi.fn(),
  mockDisable: vi.fn(),
  mockVerifyTotp: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="qr-code">{value}</div>
  ),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    twoFactor: {
      enable: mockEnable,
      disable: mockDisable,
      verifyTotp: mockVerifyTotp,
    },
  },
}));

import { TwoFactorAuth } from "@/app/profile/_components/security/two-factor-auth";

describe("TwoFactorAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables 2FA, verifies TOTP QR code, shows backup codes, and closes on Done", async () => {
    const user = userEvent.setup();
    mockEnable.mockResolvedValue({
      error: null,
      data: {
        method: "totp",
        totpURI: "otpauth://totp/test",
        backupCodes: ["code-1", "code-2"],
      },
    });
    mockVerifyTotp.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<TwoFactorAuth isEnabled={false} />);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await waitFor(() => {
      expect(screen.getByTestId("qr-code")).toHaveTextContent(
        "otpauth://totp/test",
      );
    });

    await user.type(screen.getByRole("textbox"), "123456");
    await user.click(screen.getByRole("button", { name: /submit code/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.getByText("code-1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(
      screen.getByRole("button", { name: /enable 2fa/i }),
    ).toBeInTheDocument();
  });

  it("shows error toasts when enable fails or returns non-totp method", async () => {
    const user = userEvent.setup();
    mockEnable.mockResolvedValueOnce({
      error: { message: "" },
      data: null,
    });

    render(<TwoFactorAuth isEnabled={false} />);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to enable 2FA");
    });

    mockEnable.mockResolvedValueOnce({
      error: null,
      data: { method: "otp" },
    });
    await user.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Only authenticator app codes are supported",
      );
    });
  });

  it("shows error toast with message and fallback when QR verifyTotp fails", async () => {
    const user = userEvent.setup();
    mockEnable.mockResolvedValue({
      error: null,
      data: {
        method: "totp",
        totpURI: "otpauth://totp/test",
        backupCodes: ["code-1"],
      },
    });
    mockVerifyTotp.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Bad token" } });
    });

    render(<TwoFactorAuth isEnabled={false} />);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /enable 2fa/i }));

    await waitFor(() => {
      expect(screen.getByTestId("qr-code")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("textbox"), "123456");
    await user.click(screen.getByRole("button", { name: /submit code/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Bad token");
    });

    mockVerifyTotp.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });
    await user.click(screen.getByRole("button", { name: /submit code/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to verify code");
    });
  });

  it("disables 2FA on success and shows error toasts on failure", async () => {
    const user = userEvent.setup();
    mockDisable.mockImplementationOnce(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<TwoFactorAuth isEnabled={true} />);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /disable 2fa/i }));

    await waitFor(() => {
      expect(mockDisable).toHaveBeenCalledWith(
        { password: "Password123!" },
        expect.any(Object),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });

    mockDisable.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Wrong password" } });
    });
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /disable 2fa/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Wrong password");
    });

    mockDisable.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });
    await user.click(screen.getByRole("button", { name: /disable 2fa/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to disable 2FA");
    });
  });
});
