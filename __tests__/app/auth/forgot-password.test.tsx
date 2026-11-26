import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequestPasswordReset, mockToastError, mockToastSuccess } =
  vi.hoisted(() => ({
    mockRequestPasswordReset: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    requestPasswordReset: mockRequestPasswordReset,
  },
}));

import { ForgotPassword } from "@/app/auth/login/_components/forms/forgot-password";

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends reset email and shows success toast", async () => {
    const user = userEvent.setup();
    const openSignInTab = vi.fn();
    mockRequestPasswordReset.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<ForgotPassword openSignInTab={openSignInTab} />);
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset email/i }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith(
        { email: "user@example.com", redirectTo: "/auth/reset-password" },
        expect.any(Object),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Password reset email sent",
      );
    });
  });

  it("shows error toast with message on failure", async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Rate limited" } });
    });

    render(<ForgotPassword openSignInTab={vi.fn()} />);
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset email/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Rate limited");
    });
  });

  it("shows fallback error toast when error message is empty", async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });

    render(<ForgotPassword openSignInTab={vi.fn()} />);
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset email/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to send password reset email",
      );
    });
  });

  it("calls openSignInTab when Back button is clicked", async () => {
    const user = userEvent.setup();
    const openSignInTab = vi.fn();

    render(<ForgotPassword openSignInTab={openSignInTab} />);
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(openSignInTab).toHaveBeenCalled();
  });
});
