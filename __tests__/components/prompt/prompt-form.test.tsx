import { render, screen, waitFor } from "@testing-library/react";
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
      aria-label="prompt-content-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { PromptForm } from "@/components/prompt/prompt-form";

describe("PromptForm", () => {
  it("renders with default values", () => {
    render(
      <PromptForm
        defaultValues={{
          title: "My Prompt",
          shortcut: "test-shortcut",
          content: "Prompt instructions",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("My Prompt")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test-shortcut")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Prompt instructions")).toBeInTheDocument();
  });

  it("calls onSubmit when submitted with valid values", async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(
      <PromptForm
        defaultValues={{
          title: "Code Review",
          shortcut: "review",
          content: "Review this code",
        }}
        onSubmit={onSubmitMock}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitMock.mock.calls[0][0]).toEqual({
      title: "Code Review",
      shortcut: "review",
      content: "Review this code",
    });
  });

  it("calls onCancel when cancel button is provided and clicked", async () => {
    const user = userEvent.setup();
    const onCancelMock = vi.fn();
    render(<PromptForm onSubmit={vi.fn()} onCancel={onCancelMock} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();
    await user.click(cancelButton);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
