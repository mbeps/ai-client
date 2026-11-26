import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockSearchParamsGet, mockResetPassword, mockToastError, mockToastSuccess } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockSearchParamsGet: vi.fn(),
    mockResetPassword: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    resetPassword: mockResetPassword,
  },
}));

import ResetPasswordClient from "@/app/auth/reset-password/_components/reset-password-form";

describe("ResetPasswordClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders invalid reset link state when token is missing", () => {
    mockSearchParamsGet.mockReturnValue(null);

    render(<ResetPasswordClient />);

    expect(screen.getByText("Invalid Reset Link")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to login/i })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  it("renders invalid reset link state when error param is present", () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "token" ? "valid-token" : "INVALID_TOKEN",
    );

    render(<ResetPasswordClient />);

    expect(screen.getByText("Invalid Reset Link")).toBeInTheDocument();
  });

  it("resets password, shows success toast, and redirects after 1s", async () => {
    const user = userEvent.setup();
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "token" ? "valid-token" : null,
    );
    mockResetPassword.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<ResetPasswordClient />);
    await user.type(screen.getByLabelText("Password"), "NewPassword123!");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith(
        { newPassword: "NewPassword123!", token: "valid-token" },
        expect.any(Object),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Password reset successful",
        { description: "Redirection to login..." },
      );
    });
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/auth/login");
      },
      { timeout: 2000 },
    );
  });

  it("shows error toast with message on failure", async () => {
    const user = userEvent.setup();
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "token" ? "valid-token" : null,
    );
    mockResetPassword.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Token expired" } });
    });

    render(<ResetPasswordClient />);
    await user.type(screen.getByLabelText("Password"), "NewPassword123!");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Token expired");
    });
  });

  it("shows fallback error toast when error message is empty", async () => {
    const user = userEvent.setup();
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "token" ? "valid-token" : null,
    );
    mockResetPassword.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });

    render(<ResetPasswordClient />);
    await user.type(screen.getByLabelText("Password"), "NewPassword123!");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to reset password");
    });
  });
});
