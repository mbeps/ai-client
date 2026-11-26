import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockVerifyTotp, mockToastError } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockVerifyTotp: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: mockVerifyTotp,
    },
  },
}));

import { TotpForm } from "@/app/auth/2fa/_components/totp-form";

describe("TotpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits valid 6-digit TOTP code and redirects home on success", async () => {
    const user = userEvent.setup();
    mockVerifyTotp.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<TotpForm />);
    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockVerifyTotp).toHaveBeenCalledWith(
        { code: "123456" },
        expect.any(Object),
      );
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error toast when verification fails", async () => {
    const user = userEvent.setup();
    mockVerifyTotp.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Invalid TOTP" } });
    });

    render(<TotpForm />);
    await user.type(screen.getByLabelText("Code"), "654321");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Invalid TOTP");
    });
  });

  it("shows fallback error toast when error message is empty", async () => {
    const user = userEvent.setup();
    mockVerifyTotp.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });

    render(<TotpForm />);
    await user.type(screen.getByLabelText("Code"), "654321");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to verify code");
    });
  });
});
