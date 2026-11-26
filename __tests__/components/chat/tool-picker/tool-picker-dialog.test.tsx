import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolPickerDialog } from "@/components/chat/tool-picker/tool-picker-dialog";

describe("ToolPickerDialog", () => {
  it("renders default trigger with selectedTools count badge when supportsTools is true", () => {
    render(
      <ToolPickerDialog
        servers={[]}
        selectedTools={new Set(["tool-a", "tool-b"])}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        supportsTools={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Select Tools/i })).toBeEnabled();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders disabled Tools Unsupported default trigger when supportsTools is false", () => {
    render(
      <ToolPickerDialog
        servers={[]}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        supportsTools={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Tools Unsupported/i }),
    ).toBeDisabled();
  });
});
