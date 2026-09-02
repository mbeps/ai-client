import { render } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Capture the props BlockNoteView receives so we can assert on theming.
const capturedProps: Array<Record<string, unknown>> = [];

vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: vi.fn().mockReturnValue({ document: [] }),
}));

vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: (props: Record<string, unknown>) => {
    capturedProps.push(props);
    return <div data-testid="blocknote-view" />;
  },
}));

vi.mock("@blocknote/core", () => ({
  BlockNoteEditor: {
    create: () => ({
      tryParseMarkdownToBlocks: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

const mockUseTheme = vi.fn().mockReturnValue({
  resolvedTheme: "light",
  theme: "light",
  setTheme: vi.fn(),
});

vi.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

import MarkdownView from "@/components/chat/artifacts/markdown-view";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  capturedProps.length = 0;
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    theme: "light",
    setTheme: vi.fn(),
  });
});

describe("MarkdownView — theme", () => {
  it("passes light theme to BlockNoteView when resolvedTheme is light", async () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: "light",
      theme: "light",
      setTheme: vi.fn(),
    });

    render(<MarkdownView content="# Hello" />);
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

    render(<MarkdownView content="# Hello Dark" />);
    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
    const last = capturedProps[capturedProps.length - 1];
    expect(last.theme).toBe("dark");
  });
});
