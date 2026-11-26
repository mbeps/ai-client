import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockLinkSocial, mockUnlinkAccount } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockLinkSocial: vi.fn(),
  mockUnlinkAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    linkSocial: mockLinkSocial,
    unlinkAccount: mockUnlinkAccount,
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

import { AccountLinking } from "@/app/profile/_components/account/account-linking";

describe("AccountLinking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkSocial.mockResolvedValue({ error: null });
    mockUnlinkAccount.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
      return { error: null };
    });
  });

  it("shows empty state when no accounts are linked and links a provider", async () => {
    const user = userEvent.setup();
    render(<AccountLinking currentAccounts={[]} />);

    expect(screen.getByText("No linked accounts found")).toBeInTheDocument();

    const linkButtons = screen.getAllByRole("button", { name: /link/i });
    await user.click(linkButtons[0]);

    await waitFor(() => {
      expect(mockLinkSocial).toHaveBeenCalledWith({
        provider: expect.any(String),
        callbackURL: "/profile",
      });
    });
  });

  it("renders linked accounts including unknown provider fallback and unlinks on click", async () => {
    const user = userEvent.setup();
    render(
      <AccountLinking
        currentAccounts={[
          {
            id: "1",
            accountId: "acc-1",
            providerId: "github",
            createdAt: new Date("2025-01-01"),
            updatedAt: new Date("2025-01-01"),
            userId: "u1",
            scopes: [],
          },
          {
            id: "2",
            accountId: "acc-2",
            providerId: "custom-sso",
            createdAt: new Date("2025-01-02"),
            updatedAt: new Date("2025-01-02"),
            userId: "u1",
            scopes: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("custom-sso")).toBeInTheDocument();

    const unlinkButtons = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(unlinkButtons[0]);

    await waitFor(() => {
      expect(mockUnlinkAccount).toHaveBeenCalledWith(
        { accountId: "acc-1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
