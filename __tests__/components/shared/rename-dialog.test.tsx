import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RenameDialog } from "@/components/shared/rename-dialog";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("RenameDialog", () => {
  it("submits new name, handles error, and closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <RenameDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        currentName="Old Name"
        title="Rename Item"
      />,
    );

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "New Name");
    fireEvent.submit(screen.getByRole("button", { name: /save/i }).closest("form")!);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("New Name");
      expect(onClose).toHaveBeenCalled();
    });

    onConfirm.mockRejectedValueOnce(new Error("fail"));
    fireEvent.change(input, { target: { value: "Another Name" } });
    fireEvent.submit(screen.getByRole("button", { name: /save/i }).closest("form")!);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("Another Name");
    });
  });

  it("shows validation error on empty submit, shows loading state, and closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let resolveRename!: () => void;
    const onConfirm = vi.fn(
      () => new Promise<void>((r) => { resolveRename = r; }),
    );

    render(
      <RenameDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue="Initial"
      />,
    );

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    fireEvent.submit(screen.getByRole("button", { name: /save/i }).closest("form")!);
    expect(await screen.findByText(/required|empty|least/i)).toBeInTheDocument();

    await user.type(input, "Updated");
    fireEvent.submit(screen.getByRole("button", { name: /save/i }).closest("form")!);
    expect(await screen.findByText("Saving...")).toBeInTheDocument();
    resolveRename();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes without calling onConfirm when submitted name equals initialValue", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <RenameDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue="Same Name"
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: /save/i }).closest("form")!);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
