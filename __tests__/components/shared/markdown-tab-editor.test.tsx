import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

const { mockDocument } = vi.hoisted(() => ({
  mockDocument: [
    { id: "1", type: "paragraph", props: {}, content: [], children: [] },
  ],
}));

vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: vi.fn().mockReturnValue({
    document: mockDocument,
    blocksToMarkdownLossy: vi.fn().mockResolvedValue("Updated BlockNote text"),
  }),
}));

vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: (props: any) => (
    <div data-testid="blocknote-view" onClick={() => props.onChange?.()}>
      BlockNote View Mock
    </div>
  ),
}));

vi.mock("@blocknote/core", () => ({
  BlockNoteEditor: {
    create: () => ({
      tryParseMarkdownToBlocks: vi.fn().mockResolvedValue(mockDocument),
      blocksToMarkdownLossy: vi
        .fn()
        .mockResolvedValue("Updated BlockNote text"),
    }),
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("MarkdownTabEditor", () => {
  it("renders all three tabs (Rich Text, Raw Text, Preview)", () => {
    render(<MarkdownTabEditor value="# Hello World" onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /rich text/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /raw text/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preview/i })).toBeInTheDocument();
  });

  it("renders Rich Text (BlockNote) editor by default", async () => {
    render(
      <MarkdownTabEditor value="# Some markdown content" onChange={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("blocknote-view")).toBeInTheDocument();
    });
  });

  it("switches to Raw Text tab and triggers onChange when typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <MarkdownTabEditor
        value="Initial content"
        onChange={handleChange}
        placeholder="Enter prompt..."
      />,
    );

    const rawTab = screen.getByRole("tab", { name: /raw text/i });
    await user.click(rawTab);

    const textarea = screen.getByPlaceholderText("Enter prompt...");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Initial content");

    fireEvent.change(textarea, { target: { value: "New content typed" } });
    expect(handleChange).toHaveBeenCalledWith("New content typed");
  });

  it("switches to Preview tab and renders markdown", async () => {
    const user = userEvent.setup();
    render(
      <MarkdownTabEditor
        value="# Heading 1\n**Bold text**"
        onChange={vi.fn()}
      />,
    );

    const previewTab = screen.getByRole("tab", { name: /preview/i });
    await user.click(previewTab);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Heading 1",
    );
    expect(screen.getByText("Bold text")).toBeInTheDocument();
  });

  it("shows empty placeholder in preview tab when value is empty", async () => {
    const user = userEvent.setup();
    render(<MarkdownTabEditor value="" onChange={vi.fn()} />);

    const previewTab = screen.getByRole("tab", { name: /preview/i });
    await user.click(previewTab);

    expect(
      screen.getByText(/no markdown content to preview/i),
    ).toBeInTheDocument();
  });

  it("triggers debounced onChange on Rich Text edit", async () => {
    const handleChange = vi.fn();

    render(
      <MarkdownTabEditor
        value="# Some content"
        onChange={handleChange}
        defaultTab="rich"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("blocknote-view")).toBeInTheDocument();
    });

    const blocknoteView = screen.getByTestId("blocknote-view");
    fireEvent.click(blocknoteView);

    await waitFor(
      () => {
        expect(handleChange).toHaveBeenCalledWith("Updated BlockNote text");
      },
      { timeout: 1000 },
    );
  });
});
