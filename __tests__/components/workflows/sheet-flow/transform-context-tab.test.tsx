import { fireEvent, render, screen } from "@testing-library/react";
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
      aria-label="global-context-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { TransformContextTab } from "@/components/workflows/sheet-flow/transform-context-tab";

describe("TransformContextTab", () => {
  it("renders global context editor with provided value and placeholder", () => {
    const onGlobalContextChange = vi.fn();
    render(
      <TransformContextTab
        globalContext="All prices in USD."
        onGlobalContextChange={onGlobalContextChange}
      />,
    );

    expect(screen.getByText("Global Context")).toBeInTheDocument();
    expect(screen.getByText("Background Context")).toBeInTheDocument();
    const editor = screen.getByLabelText("global-context-editor");
    expect(editor).toHaveValue("All prices in USD.");
    expect(editor).toHaveAttribute(
      "placeholder",
      "e.g. This agent handles monthly financial reports. All currency values should be in USD...",
    );
  });

  it("calls onGlobalContextChange when markdown content is updated", () => {
    const onGlobalContextChange = vi.fn();
    render(
      <TransformContextTab
        globalContext=""
        onGlobalContextChange={onGlobalContextChange}
      />,
    );

    const editor = screen.getByLabelText("global-context-editor");
    fireEvent.change(editor, { target: { value: "New background context" } });

    expect(onGlobalContextChange).toHaveBeenCalledTimes(1);
    expect(onGlobalContextChange).toHaveBeenCalledWith(
      "New background context",
    );
  });
});
