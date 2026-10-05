import { fireEvent, render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { PickerDialog } from "@/components/chat/picker-dialog";

describe("PickerDialog", () => {
  it("renders trigger and opens dialog on click", () => {
    render(
      <PickerDialog
        title="Test Picker"
        trigger={<button type="button">Open Picker</button>}
      >
        <div>Picker Content Body</div>
      </PickerDialog>,
    );

    expect(screen.queryByText("Picker Content Body")).toBeNull();
    fireEvent.click(screen.getByText("Open Picker"));
    expect(screen.getByText("Test Picker")).toBeDefined();
    expect(screen.getByText("Picker Content Body")).toBeDefined();
  });

  it("renders empty state when isEmpty is true", () => {
    render(
      <PickerDialog
        title="Empty Test Picker"
        isEmpty={true}
        emptyIcon={Sparkles}
        emptyTitle="Nothing available here"
        emptyAction={{
          label: "Go to settings",
          href: "/settings/test",
        }}
        trigger={<button type="button">Open Empty</button>}
      >
        <div>Hidden Body</div>
      </PickerDialog>,
    );

    fireEvent.click(screen.getByText("Open Empty"));
    expect(screen.getByText("Nothing available here")).toBeDefined();
    expect(screen.getByText("Go to settings")).toBeDefined();
    expect(screen.queryByText("Hidden Body")).toBeNull();
  });

  it("renders manage link and custom extraActions in footer", () => {
    const handleClear = vi.fn();
    render(
      <PickerDialog
        title="Test with Footer"
        manageAction={{
          label: "Manage Resources",
          href: "/settings/resources",
        }}
        extraActions={
          <button type="button" onClick={handleClear}>
            Clear
          </button>
        }
        trigger={<button type="button">Open Footer</button>}
      >
        <div>Content</div>
      </PickerDialog>,
    );

    fireEvent.click(screen.getByText("Open Footer"));
    expect(screen.getByText("Manage Resources")).toBeDefined();
    expect(screen.getByText("Clear")).toBeDefined();

    fireEvent.click(screen.getByText("Clear"));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("handles Cancel and Done buttons and triggers callbacks", () => {
    const handleCancel = vi.fn();
    const handleDone = vi.fn();

    render(
      <PickerDialog
        title="Test Actions"
        onCancel={handleCancel}
        onDone={handleDone}
        trigger={<button type="button">Open Actions</button>}
      >
        <div>Actions Content</div>
      </PickerDialog>,
    );

    fireEvent.click(screen.getByText("Open Actions"));
    fireEvent.click(screen.getByText("Done"));
    expect(handleDone).toHaveBeenCalledTimes(1);

    // Reopen and test Cancel
    fireEvent.click(screen.getByText("Open Actions"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("respects controlled open state", () => {
    const handleOpenChange = vi.fn();
    const { rerender } = render(
      <PickerDialog
        open={false}
        onOpenChange={handleOpenChange}
        title="Controlled Picker"
      >
        <div>Controlled Body</div>
      </PickerDialog>,
    );

    expect(screen.queryByText("Controlled Body")).toBeNull();

    rerender(
      <PickerDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Controlled Picker"
      >
        <div>Controlled Body</div>
      </PickerDialog>,
    );

    expect(screen.getByText("Controlled Body")).toBeDefined();
  });
});
