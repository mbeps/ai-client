import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";

describe("DeleteConfirmDialog", () => {
  it("renders title, description, and default button labels with icons", () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Server"
        description="Are you sure you want to delete this server?"
      />,
    );

    expect(screen.getByText("Delete Server")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this server?"),
    ).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it("renders custom confirm and cancel labels", () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Uninstall Tool"
        description="Are you sure you want to uninstall?"
        confirmLabel="Uninstall"
        confirmLoadingLabel="Uninstalling..."
        cancelLabel="Keep"
      />,
    );

    expect(screen.getByRole("button", { name: /keep/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /uninstall/i }),
    ).toBeInTheDocument();
  });

  it("renders loading state when loading is true", () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="Deleting..."
        loading={true}
        confirmLoadingLabel="Removing..."
      />,
    );

    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    const actionBtn = screen.getByRole("button", { name: /removing\.\.\./i });
    expect(actionBtn).toBeDisabled();
  });

  it("calls onConfirm and onClose on action click", async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={onCloseMock}
        onConfirm={onConfirmMock}
        title="Confirm Deletion"
        description="Warning message"
      />,
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(onConfirmMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });
});
