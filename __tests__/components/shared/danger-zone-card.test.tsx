import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";

describe("DangerZoneCard", () => {
  it("renders default title, description, consequences, and plain Delete button", () => {
    render(
      <DangerZoneCard
        consequences="Permanent deletion warning text"
        confirmTitle="Delete Item?"
        confirmDescription="Are you sure?"
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    expect(
      screen.getByText("Irreversible actions for this resource."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Permanent deletion warning text"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("renders custom title, description, and button label", () => {
    render(
      <DangerZoneCard
        title="Custom Danger"
        description="Custom warning"
        consequences="Custom consequences"
        buttonLabel="Uninstall"
        confirmTitle="Uninstall Tool?"
        confirmDescription="Are you sure?"
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Custom Danger")).toBeInTheDocument();
    expect(screen.getByText("Custom warning")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^uninstall$/i }),
    ).toBeInTheDocument();
  });

  it("opens confirmation dialog on click and calls onDelete when confirmed", async () => {
    const onDeleteMock = vi.fn().mockResolvedValue(undefined);
    render(
      <DangerZoneCard
        consequences="Action cannot be undone."
        confirmTitle="Delete Resource?"
        confirmDescription="This action is permanent."
        onDelete={onDeleteMock}
      />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Resource?")).toBeInTheDocument();
    expect(screen.getByText("This action is permanent.")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(onDeleteMock).toHaveBeenCalledTimes(1);
    });
  });

  it("closes confirmation dialog when Cancel is clicked without calling onDelete", () => {
    const onDeleteMock = vi.fn();
    render(
      <DangerZoneCard
        consequences="Action cannot be undone."
        confirmTitle="Delete Resource?"
        confirmDescription="This action is permanent."
        onDelete={onDeleteMock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDeleteMock).not.toHaveBeenCalled();
  });

  it("disables button when isDeleting or disabled is true", () => {
    const { rerender } = render(
      <DangerZoneCard
        consequences="Warning"
        confirmTitle="Delete?"
        confirmDescription="Cannot be undone."
        onDelete={vi.fn()}
        isDeleting={true}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();

    rerender(
      <DangerZoneCard
        consequences="Warning"
        confirmTitle="Delete?"
        confirmDescription="Cannot be undone."
        onDelete={vi.fn()}
        isDeleting={false}
        disabled={true}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
