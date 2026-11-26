import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignUpEmail, mockToastError, mockEnv } = vi.hoisted(() => ({
  mockSignUpEmail: vi.fn(),
  mockToastError: vi.fn(),
  mockEnv: { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: true },
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signUp: {
      email: mockSignUpEmail,
    },
  },
}));

import { SignUpTab } from "@/app/auth/login/_components/tabs/sign-up-tab";

describe("SignUpTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = true;
  });

  it("opens email verification tab when signup succeeds with unverified email", async () => {
    const user = userEvent.setup();
    const openEmailVerificationTab = vi.fn();
    mockSignUpEmail.mockResolvedValue({
      error: null,
      data: { user: { emailVerified: false } },
    });

    render(<SignUpTab openEmailVerificationTab={openEmailVerificationTab} />);
    await user.type(screen.getByLabelText("Name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalledWith(
        {
          name: "Test User",
          email: "new@example.com",
          password: "Password123!",
          callbackURL: "/",
        },
        expect.any(Object),
      );
      expect(openEmailVerificationTab).toHaveBeenCalledWith("new@example.com");
    });
  });

  it("does not open email verification tab when email is already verified", async () => {
    const user = userEvent.setup();
    const openEmailVerificationTab = vi.fn();
    mockSignUpEmail.mockResolvedValue({
      error: null,
      data: { user: { emailVerified: true } },
    });

    render(<SignUpTab openEmailVerificationTab={openEmailVerificationTab} />);
    await user.type(screen.getByLabelText("Name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalled();
      expect(openEmailVerificationTab).not.toHaveBeenCalled();
    });
  });

  it("shows error toast with message and fallback when signup fails", async () => {
    const user = userEvent.setup();
    mockSignUpEmail.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Email already exists" } });
      return { error: { message: "Email already exists" }, data: null };
    });

    render(<SignUpTab openEmailVerificationTab={vi.fn()} />);
    await user.type(screen.getByLabelText("Name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Email already exists");
    });

    mockSignUpEmail.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
      return { error: { message: "" }, data: null };
    });
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to sign up");
    });
  });

  it("shows disabled message when NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD is false", () => {
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = false;

    render(<SignUpTab openEmailVerificationTab={vi.fn()} />);

    expect(
      screen.getByText("Email registration is currently disabled."),
    ).toBeInTheDocument();
  });
});
