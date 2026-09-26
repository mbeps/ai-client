import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";

describe("DangerZoneCard", () => {
  it("renders default title, description, and consequences message", () => {
    render(
      <DangerZoneCard
        consequences="Permanent deletion warning text"
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
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("renders custom title and button label", () => {
    render(
      <DangerZoneCard
        title="Custom Danger"
        description="Custom warning"
        consequences="Custom consequences"
        buttonLabel="Delete Custom Item"
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Custom Danger")).toBeInTheDocument();
    expect(screen.getByText("Custom warning")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete custom item/i }),
    ).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDeleteMock = vi.fn();
    render(
      <DangerZoneCard
        consequences="Action cannot be undone."
        onDelete={onDeleteMock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDeleteMock).toHaveBeenCalledTimes(1);
  });

  it("disables button when isDeleting or disabled is true", () => {
    const { rerender } = render(
      <DangerZoneCard
        consequences="Warning"
        onDelete={vi.fn()}
        isDeleting={true}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();

    rerender(
      <DangerZoneCard
        consequences="Warning"
        onDelete={vi.fn()}
        isDeleting={false}
        disabled={true}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
