import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignInSocial } = vi.hoisted(() => ({
  mockSignInSocial: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: {
      social: mockSignInSocial,
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

import { SocialAuthButtons } from "@/app/auth/login/_components/buttons/social-auth-buttons";
import {
  SUPPORTED_OAUTH_PROVIDER_DETAILS,
  SUPPORTED_OAUTH_PROVIDERS,
} from "@/lib/auth/o-auth-providers";

describe("SocialAuthButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInSocial.mockResolvedValue({ error: null });
  });

  it("renders a button for each supported OAuth provider and triggers social sign-in", async () => {
    const user = userEvent.setup();
    render(<SocialAuthButtons />);

    for (const provider of SUPPORTED_OAUTH_PROVIDERS) {
      const name = SUPPORTED_OAUTH_PROVIDER_DETAILS[provider].name;
      const btn = screen.getByRole("button", { name });
      await user.click(btn);
      await waitFor(() => {
        expect(mockSignInSocial).toHaveBeenCalledWith({
          provider,
          callbackURL: "/",
        });
      });
    }
  });
});
