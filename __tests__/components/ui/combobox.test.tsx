import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  useComboboxAnchor,
} from "@/components/ui/combobox";

describe("Combobox", () => {
  it("renders Combobox with showClear, ComboboxChips, ComboboxChip, ComboboxChipsInput, and ComboboxSeparator", () => {
    render(
      <Combobox open items={["a", "b"]}>
        <ComboboxInput showClear placeholder="Search" />
        <ComboboxChips>
          <ComboboxChip>Tag 1</ComboboxChip>
          <ComboboxChip showRemove={false}>Tag 2</ComboboxChip>
          <ComboboxChipsInput placeholder="Add..." />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxList>
            <ComboboxItem value="a">A</ComboboxItem>
            <ComboboxSeparator data-testid="cb-sep" />
            <ComboboxItem value="b">B</ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );

    expect(screen.getByText("Tag 1")).toBeInTheDocument();
    expect(screen.getByText("Tag 2")).toBeInTheDocument();
    expect(screen.getByTestId("cb-sep")).toBeInTheDocument();
  });

  it("returns a ref from useComboboxAnchor", () => {
    const { result, unmount } = renderHook(() => useComboboxAnchor());
    expect(result.current).toEqual({ current: null });
    unmount();
  });
});
