import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockGetSession, mockEnv } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetSession: vi.fn(),
  mockEnv: { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: true },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    getSession: mockGetSession,
  },
}));

vi.mock("@/app/auth/login/_components/buttons/social-auth-buttons", () => ({
  SocialAuthButtons: () => <div data-testid="social-auth-buttons" />,
}));

vi.mock("@/app/auth/login/_components/forms/email-verification", () => ({
  EmailVerification: ({ email }: { email: string }) => (
    <div data-testid="email-verification">{email}</div>
  ),
}));

vi.mock("@/app/auth/login/_components/forms/forgot-password", () => ({
  ForgotPassword: ({ openSignInTab }: { openSignInTab: () => void }) => (
    <button type="button" onClick={openSignInTab}>
      Back to Sign In
    </button>
  ),
}));

vi.mock("@/app/auth/login/_components/tabs/sign-in-tab", () => ({
  SignInTab: ({
    openEmailVerificationTab,
    openForgotPassword,
  }: {
    openEmailVerificationTab: (email: string) => void;
    openForgotPassword: () => void;
  }) => (
    <div data-testid="sign-in-tab">
      <button
        type="button"
        onClick={() => openEmailVerificationTab("verify@example.com")}
      >
        Open Email Verification
      </button>
      <button type="button" onClick={openForgotPassword}>
        Open Forgot Password
      </button>
    </div>
  ),
}));

vi.mock("@/app/auth/login/_components/tabs/sign-up-tab", () => ({
  SignUpTab: ({
    openEmailVerificationTab,
  }: {
    openEmailVerificationTab: (email: string) => void;
  }) => (
    <div data-testid="sign-up-tab">
      <button
        type="button"
        onClick={() => openEmailVerificationTab("signup@example.com")}
      >
        Open Sign Up Verification
      </button>
    </div>
  ),
}));

import LoginPage from "@/app/auth/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = true;
    mockGetSession.mockResolvedValue({ data: null });
  });

  it("redirects to home when session already exists", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "u1" } } });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("switches between Sign In, Sign Up, Email Verification, and Forgot Password tabs", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByTestId("sign-in-tab")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /sign up/i }));
    expect(screen.getByTestId("sign-up-tab")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open Sign Up Verification" }),
    );
    expect(screen.getByTestId("email-verification")).toHaveTextContent(
      "signup@example.com",
    );

    // TabsList is hidden on invisible tabs
    expect(screen.queryByRole("tab", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("opens forgot password tab and returns to sign in tab", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Open Forgot Password" }),
    );
    expect(
      screen.getByRole("button", { name: "Back to Sign In" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Sign In" }));
    expect(screen.getByTestId("sign-in-tab")).toBeInTheDocument();
  });

  it("hides TabsList when NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD is false", () => {
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = false;

    render(<LoginPage />);

    expect(screen.queryByRole("tab", { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /sign up/i })).not.toBeInTheDocument();
  });
});
