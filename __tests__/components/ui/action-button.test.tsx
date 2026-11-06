import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionButton } from "@/components/ui/action-button";

describe("ActionButton", () => {
  it("renders trigger button and performs action when requireAreYouSure is false", async () => {
    const actionMock = vi.fn().mockResolvedValue({ error: false });
    render(<ActionButton action={actionMock}>Click Me</ActionButton>);

    const button = screen.getByRole("button", { name: "Click Me" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("opens alert dialog when requireAreYouSure is true and renders Cancel and Yes buttons with icons", async () => {
    const actionMock = vi.fn().mockResolvedValue({ error: false });
    render(
      <ActionButton
        action={actionMock}
        requireAreYouSure
        areYouSureDescription="Are you certain?"
      >
        Delete Item
      </ActionButton>,
    );

    const triggerBtn = screen.getByRole("button", { name: "Delete Item" });
    fireEvent.click(triggerBtn);

    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("Are you certain?")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    const yesBtn = screen.getByRole("button", { name: /yes/i });
    expect(yesBtn).toBeInTheDocument();

    fireEvent.click(yesBtn);

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });
  });
});
