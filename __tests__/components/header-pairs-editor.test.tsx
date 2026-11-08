import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  HeaderPairsEditor,
  type HeaderPair,
} from "@/components/mcp/header-pairs-editor";

describe("HeaderPairsEditor", () => {
  it("renders empty state message when no pairs exist", () => {
    render(<HeaderPairsEditor pairs={[]} onChange={vi.fn()} />);
    expect(
      screen.getByText(/no additional headers configured/i),
    ).toBeDefined();
  });

  it("renders existing header pairs with name and value inputs", () => {
    const pairs: HeaderPair[] = [
      { id: "1", key: "X-Tenant-ID", value: "tenant-123" },
      { id: "2", key: "X-Env", value: "prod" },
    ];
    render(<HeaderPairsEditor pairs={pairs} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("X-Tenant-ID")).toBeDefined();
    expect(screen.getByDisplayValue("tenant-123")).toBeDefined();
    expect(screen.getByDisplayValue("X-Env")).toBeDefined();
    expect(screen.getByDisplayValue("prod")).toBeDefined();
  });

  it("calls onChange with a new empty pair when Add Header is clicked", () => {
    const onChange = vi.fn();
    render(<HeaderPairsEditor pairs={[]} onChange={onChange} />);

    const addBtn = screen.getByRole("button", { name: /add header/i });
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const addedPairs = onChange.mock.calls[0][0];
    expect(addedPairs).toHaveLength(1);
    expect(addedPairs[0].key).toBe("");
    expect(addedPairs[0].value).toBe("");
  });

  it("calls onChange with updated key when header name input changes", () => {
    const onChange = vi.fn();
    const pairs: HeaderPair[] = [{ id: "1", key: "X-Key", value: "val" }];
    render(<HeaderPairsEditor pairs={pairs} onChange={onChange} />);

    const keyInput = screen.getByLabelText("Header Name 1");
    fireEvent.change(keyInput, { target: { value: "X-Updated-Key" } });

    expect(onChange).toHaveBeenCalledWith([
      { id: "1", key: "X-Updated-Key", value: "val" },
    ]);
  });

  it("calls onChange with updated value when header value input changes", () => {
    const onChange = vi.fn();
    const pairs: HeaderPair[] = [{ id: "1", key: "X-Key", value: "val" }];
    render(<HeaderPairsEditor pairs={pairs} onChange={onChange} />);

    const valInput = screen.getByLabelText("Header Value 1");
    fireEvent.change(valInput, { target: { value: "new-val" } });

    expect(onChange).toHaveBeenCalledWith([
      { id: "1", key: "X-Key", value: "new-val" },
    ]);
  });

  it("calls onChange without the deleted pair when remove button is clicked", () => {
    const onChange = vi.fn();
    const pairs: HeaderPair[] = [
      { id: "1", key: "X-Key-1", value: "val-1" },
      { id: "2", key: "X-Key-2", value: "val-2" },
    ];
    render(<HeaderPairsEditor pairs={pairs} onChange={onChange} />);

    const removeBtn = screen.getByLabelText("Remove Header 1");
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith([
      { id: "2", key: "X-Key-2", value: "val-2" },
    ]);
  });
});
