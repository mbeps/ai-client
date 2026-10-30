import { render, screen, act } from "@testing-library/react";
import { useEffect } from "react";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const capturedProps: Array<Record<string, unknown>> = [];
let blockNoteViewMountCount = 0;
let blockNoteViewUnmountCount = 0;

const mockBlocksToMarkdownLossy = vi.fn().mockResolvedValue("# Updated Markdown");
const mockTryParseMarkdownToBlocks = vi.fn().mockImplementation(async (content: string) => [
  { id: "b1", type: "paragraph", content },
]);

vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: vi.fn().mockImplementation(({ initialContent }) => ({
    document: initialContent ?? [],
    blocksToMarkdownLossy: mockBlocksToMarkdownLossy,
  })),
}));

vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: (props: Record<string, unknown>) => {
    useEffect(() => {
      blockNoteViewMountCount++;
      return () => {
        blockNoteViewUnmountCount++;
      };
    }, []);
    capturedProps.push(props);
    return <div data-testid="blocknote-view" />;
  },
}));

vi.mock("@blocknote/core", () => ({
  BlockNoteEditor: {
    create: () => ({
      tryParseMarkdownToBlocks: mockTryParseMarkdownToBlocks,
    }),
  },
}));

vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUseTheme = vi.fn().mockReturnValue({
  resolvedTheme: "light",
  theme: "light",
  setTheme: vi.fn(),
});

vi.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

import { logger } from "@/lib/logger";
import { MarkdownView } from "@/components/chat/artifacts/markdown-view";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  capturedProps.length = 0;
  blockNoteViewMountCount = 0;
  blockNoteViewUnmountCount = 0;
  vi.clearAllMocks();
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    theme: "light",
    setTheme: vi.fn(),
  });
  mockBlocksToMarkdownLossy.mockResolvedValue("# Updated Markdown");
  mockTryParseMarkdownToBlocks.mockImplementation(async (content: string) => [
    { id: "b1", type: "paragraph", content },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MarkdownView — theme", () => {
  it("passes light theme to BlockNoteView when resolvedTheme is light", async () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: "light",
      theme: "light",
      setTheme: vi.fn(),
    });

    await act(async () => {
      render(<MarkdownView content="# Hello" />);
    });
    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
    const last = capturedProps[capturedProps.length - 1];
    expect(last.theme).toBe("light");
  });

  it("passes dark theme to BlockNoteView when resolvedTheme is dark", async () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: "dark",
      theme: "dark",
      setTheme: vi.fn(),
    });

    await act(async () => {
      render(<MarkdownView content="# Hello Dark" />);
    });
    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
    const last = capturedProps[capturedProps.length - 1];
    expect(last.theme).toBe("dark");
  });
});

describe("MarkdownView — editor remount prevention and lifecycle", () => {
  it("does not unmount BlockNoteEditor or re-parse markdown when content updates from its own onUpdate", async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();

    let utils: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <MarkdownView id="art-1" content="# Initial Content" onUpdate={onUpdate} />,
      );
    });

    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
    expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledTimes(1);
    expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledWith("# Initial Content");
    expect(blockNoteViewMountCount).toBe(1);
    expect(blockNoteViewUnmountCount).toBe(0);

    // Simulate user typing: BlockNoteView triggers onChange
    const lastProps = capturedProps[capturedProps.length - 1];
    const onChange = lastProps.onChange as () => void;
    expect(onChange).toBeDefined();

    act(() => {
      onChange();
    });

    // Advance 1000ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockBlocksToMarkdownLossy).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith("# Updated Markdown");

    // Parent re-renders MarkdownView with updated content
    await act(async () => {
      utils.rerender(
        <MarkdownView id="art-1" content="# Updated Markdown" onUpdate={onUpdate} />,
      );
    });

    // Ensure parser was NOT called again and BlockNoteView was NOT unmounted
    expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledTimes(1);
    expect(blockNoteViewUnmountCount).toBe(0);
    expect(screen.queryByTestId("loader")).toBeNull();
  });

  it("resets parsedBlocks and re-parses when artifact id changes", async () => {
    const onUpdate = vi.fn();

    let utils: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <MarkdownView id="art-1" content="# Artifact One" onUpdate={onUpdate} />,
      );
    });

    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
    expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledWith("# Artifact One");
    expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledTimes(1);

    // Switch artifact id
    await act(async () => {
      utils.rerender(
        <MarkdownView id="art-2" content="# Artifact Two" onUpdate={onUpdate} />,
      );
    });

    await vi.waitFor(() =>
      expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledWith("# Artifact Two"),
    );
    expect(mockTryParseMarkdownToBlocks).toHaveBeenCalledTimes(2);
  });

  it("handles parse error gracefully by logging error and setting empty blocks", async () => {
    const parseError = new Error("Parse failure");
    mockTryParseMarkdownToBlocks.mockRejectedValueOnce(parseError);

    await act(async () => {
      render(<MarkdownView id="art-err" content="# Broken" />);
    });

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith("Failed to parse markdown", parseError);
    });
    // Even on error, it renders BlockNoteEditor with empty blocks
    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
  });

  it("handles markdown serialization error in BlockNoteEditor gracefully", async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const serializeError = new Error("Serialize failed");
    mockBlocksToMarkdownLossy.mockRejectedValueOnce(serializeError);

    await act(async () => {
      render(<MarkdownView id="art-ser" content="# Test" onUpdate={onUpdate} />);
    });
    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));

    const onChange = capturedProps[capturedProps.length - 1].onChange as () => void;
    act(() => {
      onChange();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to serialize markdown blocks",
      serializeError,
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
