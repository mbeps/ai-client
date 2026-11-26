import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: ({
    action,
    children,
  }: {
    action: () => Promise<{ error: boolean; message?: string }>;
    children?: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={async () => {
        const res = await action();
        const el = document.getElementById("action-result");
        if (el) el.textContent = JSON.stringify(res);
      }}
    >
      {children}
      <span id="action-result" />
    </button>
  ),
}));

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";

describe("BetterAuthActionButton", () => {
  it("returns error: false with successMessage when action succeeds", async () => {
    const action = vi.fn().mockResolvedValue({ error: null });
    render(
      <BetterAuthActionButton action={action} successMessage="Done!">
        Click me
      </BetterAuthActionButton>,
    );

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(document.getElementById("action-result")?.textContent).toBe(
        JSON.stringify({ error: false, message: "Done!" }),
      );
    });
  });

  it("returns error: true with error.message when action fails with message", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ error: { message: "Invalid token" } });
    render(
      <BetterAuthActionButton action={action}>Click me</BetterAuthActionButton>,
    );

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(document.getElementById("action-result")?.textContent).toBe(
        JSON.stringify({ error: true, message: "Invalid token" }),
      );
    });
  });

  it("falls back to 'Action failed' when error.message is missing", async () => {
    const action = vi.fn().mockResolvedValue({ error: {} });
    render(
      <BetterAuthActionButton action={action}>Click me</BetterAuthActionButton>,
    );

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(document.getElementById("action-result")?.textContent).toBe(
        JSON.stringify({ error: true, message: "Action failed" }),
      );
    });
  });
});
