import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

const { mockDocument, mockReplaceBlocks, mockTryParseMarkdownToBlocks } =
  vi.hoisted(() => ({
    mockDocument: [
      { id: "1", type: "paragraph", props: {}, content: [], children: [] },
    ],
    mockReplaceBlocks: vi.fn(),
    mockTryParseMarkdownToBlocks: vi.fn(),
  }));

vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: vi.fn().mockReturnValue({
    document: mockDocument,
    blocksToMarkdownLossy: vi.fn().mockResolvedValue("Updated BlockNote text"),
    replaceBlocks: mockReplaceBlocks,
    tryParseMarkdownToBlocks:
      mockTryParseMarkdownToBlocks.mockResolvedValue(mockDocument),
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

  it("updates BlockNote editor when value prop changes externally", async () => {
    const { rerender } = render(
      <MarkdownTabEditor value="# Initial content" onChange={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("blocknote-view")).toBeInTheDocument();
    });

    mockReplaceBlocks.mockClear();

    rerender(
      <MarkdownTabEditor value="# External update" onChange={vi.fn()} />,
    );

    await waitFor(() => {
      expect(mockReplaceBlocks).toHaveBeenCalled();
    });
  });

  it("uses dark:bg-transparent on raw textarea to match editor card surface in dark mode", async () => {
    const user = userEvent.setup();
    render(
      <MarkdownTabEditor
        value="Raw text"
        onChange={vi.fn()}
        placeholder="Raw placeholder"
      />,
    );

    await user.click(screen.getByRole("tab", { name: /raw text/i }));
    const textarea = screen.getByPlaceholderText("Raw placeholder");
    expect(textarea).toHaveClass("bg-transparent", "dark:bg-transparent");
  });

  it("handles blocknote defaultTab, empty parsed blocks, sync errors, rapid onChange, and dark theme", async () => {
    const nextThemes = await import("next-themes");
    vi.spyOn(nextThemes, "useTheme").mockReturnValue({
      resolvedTheme: "dark",
      theme: "dark",
      setTheme: vi.fn(),
      themes: ["light", "dark"],
    } as never);

    const onChange = vi.fn();
    const { rerender, unmount } = render(
      <MarkdownTabEditor value="Initial" onChange={onChange} defaultTab="blocknote" />,
    );

    const view = await screen.findByTestId("blocknote-view");
    // Rapid double click to trigger clearTimeout(timerRef.current)
    fireEvent.click(view);
    fireEvent.click(view);

    // Sync external content returning empty array -> fallback paragraph block
    mockTryParseMarkdownToBlocks.mockResolvedValueOnce([]);
    rerender(<MarkdownTabEditor value="Empty" onChange={onChange} defaultTab="blocknote" />);
    await waitFor(() => {
      expect(mockReplaceBlocks).toHaveBeenCalledWith(mockDocument, [
        { type: "paragraph", content: [] },
      ]);
    });

    // Sync external content rejecting -> logger.error
    mockTryParseMarkdownToBlocks.mockRejectedValueOnce(new Error("Sync fail"));
    rerender(<MarkdownTabEditor value="Fail" onChange={onChange} defaultTab="blocknote" />);
    await waitFor(() => {
      expect(mockTryParseMarkdownToBlocks).toHaveBeenCalled();
    });

    // Unmount while syncExternalContent is pending -> cancelled = true
    let resolveSync!: (v: unknown) => void;
    mockTryParseMarkdownToBlocks.mockReturnValueOnce(
      new Promise((r) => {
        resolveSync = r;
      }),
    );
    rerender(<MarkdownTabEditor value="Pending" onChange={onChange} defaultTab="blocknote" />);
    unmount();
    resolveSync([]);
  });

  it("handles initial parse failure and blocksToMarkdownLossy failure", async () => {
    const bnCore = await import("@blocknote/core");
    vi.spyOn(bnCore.BlockNoteEditor, "create").mockReturnValueOnce({
      tryParseMarkdownToBlocks: vi.fn().mockRejectedValueOnce(new Error("Init fail")),
    } as never);

    const bnReact = await import("@blocknote/react");
    vi.mocked(bnReact.useCreateBlockNote).mockReturnValueOnce({
      document: mockDocument,
      blocksToMarkdownLossy: vi.fn().mockRejectedValueOnce(new Error("Serialize fail")),
      replaceBlocks: mockReplaceBlocks,
      tryParseMarkdownToBlocks: mockTryParseMarkdownToBlocks,
    } as never);

    render(<MarkdownTabEditor value="Init" onChange={vi.fn()} />);
    const view = await screen.findByTestId("blocknote-view");
    fireEvent.click(view);
    await new Promise((r) => setTimeout(r, 350));
    await waitFor(() => {
      expect(view).toBeInTheDocument();
    });

    // Unmounted during initial parse failure
    let rejectInit!: (e: Error) => void;
    vi.spyOn(bnCore.BlockNoteEditor, "create").mockReturnValueOnce({
      tryParseMarkdownToBlocks: vi.fn().mockReturnValueOnce(
        new Promise((_, rej) => {
          rejectInit = rej;
        }),
      ),
    } as never);
    const { unmount } = render(<MarkdownTabEditor value="Init2" onChange={vi.fn()} />);
    unmount();
    rejectInit(new Error("Late fail"));
  });
});
