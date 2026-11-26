import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockRefetch, mockSignInPasskey } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefetch: vi.fn(),
  mockSignInPasskey: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ refetch: mockRefetch }),
    signIn: {
      passkey: mockSignInPasskey,
    },
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

import { PasskeyButton } from "@/app/auth/login/_components/buttons/passkey-button";

describe("PasskeyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initiates passkey sign-in, refetches session, and redirects home on success", async () => {
    const user = userEvent.setup();
    mockSignInPasskey.mockImplementation(async (_opts, callbacks) => {
      callbacks?.onSuccess?.();
      return { error: null };
    });

    render(<PasskeyButton />);
    await user.click(screen.getByRole("button", { name: /use passkey/i }));

    await waitFor(() => {
      expect(mockSignInPasskey).toHaveBeenCalledWith(
        { autoFill: false },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockRefetch).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });
});
