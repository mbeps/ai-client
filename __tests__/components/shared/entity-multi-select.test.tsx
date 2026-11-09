import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityMultiSelect } from "@/components/shared/entity-multi-select";

describe("EntityMultiSelect", () => {
  const items = [
    { id: "1", name: "Alpha Project" },
    { id: "2", name: "Beta Project" },
    { id: "3", name: "Gamma Project" },
  ];

  it("renders trigger with placeholder when empty", () => {
    render(
      <EntityMultiSelect
        items={items}
        selectedIds={[]}
        onChange={vi.fn()}
        placeholder="Select projects..."
      />,
    );

    expect(screen.getByText("Select projects...")).toBeInTheDocument();
  });

  it("renders selected items as badge chips", () => {
    render(
      <EntityMultiSelect
        items={items}
        selectedIds={["1", "2"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Project")).toBeInTheDocument();
    expect(screen.queryByText("Gamma Project")).not.toBeInTheDocument();
  });

  it("removes item when clicking remove button on badge chip", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EntityMultiSelect
        items={items}
        selectedIds={["1", "2"]}
        onChange={onChange}
      />,
    );

    const removeBtn = screen.getByLabelText("Remove Alpha Project");
    await user.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(["2"]);
  });

  it("opens popover, allows toggling items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EntityMultiSelect
        items={items}
        selectedIds={["1"]}
        onChange={onChange}
        placeholder="Select projects..."
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

    const betaOption = screen.getByText("Beta Project");
    await user.click(betaOption);

    expect(onChange).toHaveBeenCalledWith(["1", "2"]);
  });

  it("supports select all and clear all", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <EntityMultiSelect
        items={items}
        selectedIds={[]}
        onChange={onChange}
        placeholder="Select projects..."
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    const selectAllBtn = screen.getByRole("button", { name: /select all/i });
    await user.click(selectAllBtn);

    expect(onChange).toHaveBeenCalledWith(["1", "2", "3"]);

    rerender(
      <EntityMultiSelect
        items={items}
        selectedIds={["1", "2", "3"]}
        onChange={onChange}
        placeholder="Select projects..."
      />,
    );

    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });
    await user.click(clearAllBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renders disabled state", () => {
    render(
      <EntityMultiSelect
        items={items}
        selectedIds={["1"]}
        onChange={vi.fn()}
        disabled
      />,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
  });
});
