import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockAddPasskey, mockDeletePasskey, mockToastError } =
  vi.hoisted(() => ({
    mockRefresh: vi.fn(),
    mockAddPasskey: vi.fn(),
    mockDeletePasskey: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    passkey: {
      addPasskey: mockAddPasskey,
      deletePasskey: mockDeletePasskey,
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
    <button type="button" onClick={() => void action()} aria-label="Delete passkey">
      {children}
    </button>
  ),
}));

import { PasskeyManagement } from "@/app/profile/_components/security/passkey-management";

describe("PasskeyManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state and adds a passkey via dialog", async () => {
    const user = userEvent.setup();
    mockAddPasskey.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
    });

    render(<PasskeyManagement passkeys={[]} />);
    expect(screen.getByText("No passkeys yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /new passkey/i }));
    await user.type(screen.getByLabelText("Name"), "MacBook Touch ID");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(mockAddPasskey).toHaveBeenCalledWith(
        { name: "MacBook Touch ID" },
        expect.any(Object),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error toast with message and fallback when adding passkey fails", async () => {
    const user = userEvent.setup();
    mockAddPasskey.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "Passkey cancelled" } });
    });

    render(<PasskeyManagement passkeys={[]} />);
    await user.click(screen.getByRole("button", { name: /new passkey/i }));
    await user.type(screen.getByLabelText("Name"), "YubiKey");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Passkey cancelled");
    });

    mockAddPasskey.mockImplementationOnce(async (_data, opts) => {
      opts?.onError?.({ error: { message: "" } });
    });
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to add passkey");
    });
  });

  it("renders existing passkeys and deletes one on click", async () => {
    const user = userEvent.setup();
    mockDeletePasskey.mockImplementation(async (_data, opts) => {
      opts?.onSuccess?.();
      return { error: null };
    });

    render(
      <PasskeyManagement
        passkeys={[
          {
            id: "pk-1",
            name: "My Key",
            createdAt: new Date("2025-01-01"),
            publicKey: "pub",
            userId: "u1",
            credentialID: "cred",
            counter: 0,
            deviceType: "singleDevice",
            backedUp: false,
            transports: "internal",
          },
        ]}
      />,
    );

    expect(screen.getByText("My Key")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete passkey" }));

    await waitFor(() => {
      expect(mockDeletePasskey).toHaveBeenCalledWith(
        { id: "pk-1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("closes the new passkey dialog when Escape is pressed", async () => {
    render(<PasskeyManagement passkeys={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /New Passkey/i }));
    expect(screen.getByText("Add New Passkey")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Add New Passkey")).not.toBeInTheDocument();
    });
  });
});
