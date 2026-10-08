import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubagentConfigDialog } from "@/components/chat/subagent-config-dialog";

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: vi.fn(() => ({
    models: [
      {
        id: "m-1",
        modelId: "gpt-4o",
        label: "GPT-4o",
        providerName: "OpenAI",
      },
    ],
    isLoading: false,
  })),
}));

describe("SubagentConfigDialog", () => {
  it("renders title, description, and toggle", () => {
    const handleToggle = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={false}
        onToggleSubagents={handleToggle}
        onSubagentModelChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Subagents")).toBeDefined();
    expect(
      screen.getByText(/Delegate complex tasks to isolated worker subagents/),
    ).toBeDefined();
    expect(screen.getByText("Enable Subagents")).toBeDefined();

    const switchEl = screen.getByLabelText("Toggle subagents");
    fireEvent.click(switchEl);
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it("renders active badge when enabled is true", () => {
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("Worker Subagent Model")).toBeDefined();
    expect(screen.getByText(/Tool Inheritance & Sandboxing/)).toBeDefined();
  });

  it("calls onOpenChange(false) when Done button is clicked", () => {
    const handleOpenChange = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={handleOpenChange}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
      />,
    );

    const doneButton = screen.getByRole("button", { name: /Done/i });
    fireEvent.click(doneButton);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});

