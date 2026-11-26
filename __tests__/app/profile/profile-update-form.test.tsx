import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockUpdateUser, mockToastError, mockToastSuccess } =
  vi.hoisted(() => ({
    mockRefresh: vi.fn(),
    mockUpdateUser: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
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
    updateUser: mockUpdateUser,
  },
}));

import { ProfileUpdateForm } from "@/app/profile/_components/profile/profile-update-form";

describe("ProfileUpdateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates profile name, shows success toast, and refreshes router", async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValue({ error: null });

    render(
      <ProfileUpdateForm user={{ name: "Old Name", email: "a@example.com" }} />,
    );
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ name: "New Name" });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Profile updated successfully",
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error toast with message and fallback when update fails", async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValueOnce({ error: { message: "Update failed" } });

    render(
      <ProfileUpdateForm user={{ name: "Old Name", email: "a@example.com" }} />,
    );
    await user.click(screen.getByRole("button", { name: /update profile/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Update failed");
    });

    mockUpdateUser.mockResolvedValueOnce({ error: { message: "" } });
    await user.click(screen.getByRole("button", { name: /update profile/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to update profile");
    });
  });
});
