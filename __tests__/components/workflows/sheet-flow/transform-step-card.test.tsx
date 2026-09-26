import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="step-prompt-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { TransformStepCard } from "@/components/workflows/sheet-flow/transform-step-card";
import type { TransformStep } from "@/types/transform/transform-step";

describe("TransformStepCard", () => {
  const mockStep: TransformStep = {
    id: "step-1",
    name: "Filter rows",
    prompt: "Remove rows where revenue < 0",
    order: 0,
    requiresReview: false,
    mcpServerIds: [],
    toolIds: [],
  };

  it("renders step card with title, index, prompt and review switch", () => {
    render(
      <TransformStepCard
        step={mockStep}
        index={0}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Filter rows")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("AI Prompt")).toBeInTheDocument();

    const editor = screen.getByLabelText("step-prompt-editor");
    expect(editor).toHaveValue("Remove rows where revenue < 0");
    expect(editor).toHaveAttribute(
      "placeholder",
      "Instruct the AI on what to do in this step...",
    );
  });

  it("updates prompt using markdown editor and fires onUpdate", () => {
    const onUpdate = vi.fn();
    render(
      <TransformStepCard
        step={mockStep}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    const editor = screen.getByLabelText("step-prompt-editor");
    fireEvent.change(editor, {
      target: { value: "Updated prompt instructions with **markdown**" },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      prompt: "Updated prompt instructions with **markdown**",
    });
  });

  it("toggles human review switch and fires onUpdate", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <TransformStepCard
        step={mockStep}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    const switchEl = screen.getByRole("switch");
    expect(switchEl).not.toBeChecked();

    await user.click(switchEl);
    expect(onUpdate).toHaveBeenCalledWith({ requiresReview: true });
  });

  it("calls onRemove when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <TransformStepCard
        step={mockStep}
        index={0}
        onUpdate={vi.fn()}
        onRemove={onRemove}
      />,
    );

    // Delete button has Trash2 icon
    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons[1]; // Edit, Delete
    await user.click(deleteBtn);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("allows inline name editing and saves on enter or check button", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <TransformStepCard
        step={mockStep}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const editBtn = buttons[0]; // Edit button
    await user.click(editBtn);

    const nameInput = screen.getByDisplayValue("Filter rows");
    expect(nameInput).toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, "Clean data");

    const checkBtn = screen.getAllByRole("button")[0];
    await user.click(checkBtn);

    expect(onUpdate).toHaveBeenCalledWith({ name: "Clean data" });
    await waitFor(() => {
      expect(nameInput).not.toBeInTheDocument();
    });
  });
});
