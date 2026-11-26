import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRedirect, mockEnv } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockEnv: { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: true },
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/app/auth/reset-password/_components/reset-password-form", () => ({
  default: () => <div data-testid="reset-password-form" />,
}));

import ResetPasswordPage from "@/app/auth/reset-password/page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = true;
  });

  it("redirects to login when email/password auth is disabled", () => {
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = false;

    ResetPasswordPage();

    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
  });

  it("renders ResetPasswordForm when email/password auth is enabled", () => {
    render(<ResetPasswordPage />);

    expect(screen.getByTestId("reset-password-form")).toBeInTheDocument();
  });
});
