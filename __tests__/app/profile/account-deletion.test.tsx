import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeleteUser } = vi.hoisted(() => ({
  mockDeleteUser: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    deleteUser: mockDeleteUser,
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

import { AccountDeletion } from "@/app/profile/_components/account/account-deletion";

describe("AccountDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteUser.mockResolvedValue({ error: null });
  });

  it("calls authClient.deleteUser with home callbackURL on click", async () => {
    const user = userEvent.setup();
    render(<AccountDeletion />);

    await user.click(
      screen.getByRole("button", { name: /delete account permanently/i }),
    );

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith({ callbackURL: "/" });
    });
  });
});
