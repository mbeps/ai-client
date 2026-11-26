import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockVerifyBackupCode, mockToastError } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockVerifyBackupCode: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyBackupCode: mockVerifyBackupCode,
    },
  },
}));

import { BackupCodeTab } from "@/app/auth/2fa/_components/backup-code-tab";

describe("BackupCodeTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits backup code and redirects home on success", async () => {
    const user = userEvent.setup();
    mockVerifyBackupCode.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<BackupCodeTab />);
    await user.type(screen.getByLabelText("Backup Code"), "abc-123-def");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockVerifyBackupCode).toHaveBeenCalledWith(
        { code: "abc-123-def" },
        expect.any(Object),
      );
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error toast when backup code verification fails", async () => {
    const user = userEvent.setup();
    mockVerifyBackupCode.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Invalid backup code" } });
    });

    render(<BackupCodeTab />);
    await user.type(screen.getByLabelText("Backup Code"), "bad-code");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Invalid backup code");
    });
  });

  it("shows fallback error toast when error message is empty", async () => {
    const user = userEvent.setup();
    mockVerifyBackupCode.mockImplementation(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });

    render(<BackupCodeTab />);
    await user.type(screen.getByLabelText("Backup Code"), "bad-code");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to verify code");
    });
  });
});
