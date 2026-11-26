import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequestPasswordReset } = vi.hoisted(() => ({
  mockRequestPasswordReset: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    requestPasswordReset: mockRequestPasswordReset,
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

import { SetPasswordButton } from "@/app/profile/_components/security/set-password-button";

describe("SetPasswordButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestPasswordReset.mockResolvedValue({ error: null });
  });

  it("requests password reset email for the provided email", async () => {
    const user = userEvent.setup();
    render(<SetPasswordButton email="oauth@example.com" />);

    await user.click(
      screen.getByRole("button", { name: /send password reset email/i }),
    );

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith({
        email: "oauth@example.com",
        redirectTo: "/auth/reset-password",
      });
    });
  });
});
