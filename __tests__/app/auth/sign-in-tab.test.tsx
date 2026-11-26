import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockSignInEmail, mockToastError, mockEnv } = vi.hoisted(
  () => ({
    mockPush: vi.fn(),
    mockSignInEmail: vi.fn(),
    mockToastError: vi.fn(),
    mockEnv: { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: true },
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: {
      email: mockSignInEmail,
    },
  },
}));

vi.mock("@/app/auth/login/_components/buttons/passkey-button", () => ({
  PasskeyButton: () => <div data-testid="passkey-button" />,
}));

import { SignInTab } from "@/app/auth/login/_components/tabs/sign-in-tab";

describe("SignInTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = true;
  });

  it("signs in with email and password and redirects home on success", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(
      <SignInTab
        openEmailVerificationTab={vi.fn()}
        openForgotPassword={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith(
        {
          email: "user@example.com",
          password: "Password123!",
          callbackURL: "/",
        },
        expect.any(Object),
      );
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("opens email verification tab on EMAIL_NOT_VERIFIED error", async () => {
    const user = userEvent.setup();
    const openEmailVerificationTab = vi.fn();
    mockSignInEmail.mockImplementation(async (_data, opts) => {
      opts?.onError?.({
        error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      });
    });

    render(
      <SignInTab
        openEmailVerificationTab={openEmailVerificationTab}
        openForgotPassword={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(openEmailVerificationTab).toHaveBeenCalledWith("user@example.com");
      expect(mockToastError).toHaveBeenCalledWith("Email not verified");
    });
  });

  it("shows fallback error toast when error message is empty", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockImplementation(async (_data, opts) => {
      opts?.onError?.({
        error: { code: "INVALID_CREDENTIALS", message: "" },
      });
    });

    render(
      <SignInTab
        openEmailVerificationTab={vi.fn()}
        openForgotPassword={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to sign in");
    });
  });

  it("hides email/password form when NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD is false", () => {
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = false;

    render(
      <SignInTab
        openEmailVerificationTab={vi.fn()}
        openForgotPassword={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByTestId("passkey-button")).toBeInTheDocument();
  });
});
