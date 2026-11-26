import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";

describe("BaseEntityOptions", () => {
  it("renders menu and closes RenameDialog and DeleteConfirmDialog via onClose", () => {
    const setShowRename = vi.fn();
    const setShowDelete = vi.fn();

    render(
      <BaseEntityOptions
        name="Item 1"
        items={[]}
        isMobile={false}
        showRename={true}
        setShowRename={setShowRename}
        handleRename={vi.fn()}
        renameTitle="Rename Item"
        renameLabel="Name"
        showDelete={true}
        setShowDelete={setShowDelete}
        handleDelete={vi.fn()}
        isDeleting={false}
        deleteTitle="Delete Item"
      />,
    );

    expect(screen.getByText("Rename Item")).toBeInTheDocument();
    expect(screen.getByText("Delete Item")).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i, hidden: true });
    for (const btn of cancelButtons) {
      fireEvent.click(btn);
    }
    expect(setShowRename).toHaveBeenCalledWith(false);
    expect(setShowDelete).toHaveBeenCalledWith(false);
  });
});
