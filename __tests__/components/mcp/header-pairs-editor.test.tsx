import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderPairsEditor } from "@/components/mcp/header-pairs-editor";

describe("HeaderPairsEditor", () => {
  it("renders with styled=true and updates only the matching pair", () => {
    const onChange = vi.fn();
    render(
      <HeaderPairsEditor
        styled
        pairs={[
          { id: "p1", key: "X-One", value: "1" },
          { id: "p2", key: "X-Two", value: "2" },
        ]}
        onChange={onChange}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveClass("bg-background");

    fireEvent.change(inputs[0], { target: { value: "X-Updated" } });
    expect(onChange).toHaveBeenCalledWith([
      { id: "p1", key: "X-Updated", value: "1" },
      { id: "p2", key: "X-Two", value: "2" },
    ]);
  });
});
