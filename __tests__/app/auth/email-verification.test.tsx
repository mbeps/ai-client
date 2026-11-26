import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendVerificationEmail } = vi.hoisted(() => ({
  mockSendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    sendVerificationEmail: mockSendVerificationEmail,
  },
}));

vi.mock("@/components/auth/buttons/better-auth-action-button", () => ({
  BetterAuthActionButton: ({
    action,
    disabled,
    children,
  }: {
    action: () => Promise<unknown>;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button type="button" disabled={disabled} onClick={() => void action()}>
      {children}
    </button>
  ),
}));

import { EmailVerification } from "@/app/auth/login/_components/forms/email-verification";

describe("EmailVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSendVerificationEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down from 30s and enables resend button when countdown reaches 0", async () => {
    render(<EmailVerification email="user@example.com" />);

    const btn = screen.getByRole("button", { name: /resend email \(30\)/i });
    expect(btn).toBeDisabled();

    for (let i = 0; i < 30; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    const enabledBtn = screen.getByRole("button", { name: /^resend email$/i });
    expect(enabledBtn).toBeEnabled();

    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(enabledBtn);

    expect(mockSendVerificationEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      callbackURL: "/",
    });
  });
});
