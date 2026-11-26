import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveredToolItem } from "@/components/chat/tool-picker/discovered-tool-item";

describe("DiscoveredToolItem", () => {
  it("renders tool name and description and calls onToggle on checkbox change", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <DiscoveredToolItem
        serverId="srv-1"
        tool={{ name: "read_file", description: "Reads a file" }}
        isChecked={false}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(screen.getByText("Reads a file")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("srv-1", "read_file");

    rerender(
      <DiscoveredToolItem
        serverId="srv-1"
        tool={{ name: "no_desc" }}
        isChecked={true}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("no_desc")).toBeInTheDocument();
  });
});
