import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockChangePassword, mockToastError, mockToastSuccess } = vi.hoisted(
  () => ({
    mockChangePassword: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }),
);

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    changePassword: mockChangePassword,
  },
}));

import { ChangePasswordForm } from "@/app/profile/_components/security/change-password-form";

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("changes password, shows success toast, and resets form", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith(
        {
          currentPassword: "OldPass123!",
          newPassword: "NewPass123!",
          revokeOtherSessions: true,
        },
        expect.any(Object),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Password changed successfully",
      );
    });
  });

  it("shows error toast with message and fallback on failure", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Wrong current password" } });
    });

    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Wrong current password");
    });

    mockChangePassword.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to change password");
    });
  });
});
