import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

import MarkdownView from "@/components/chat/artifacts/markdown-view";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("MarkdownView — theme (ART-08)", () => {
  it("does not hardcode the light theme", async () => {
    render(<MarkdownView content="# Hello" />);
    // Wait one tick for the parsed-blocks editor mount
    await vi.waitFor(() => expect(capturedProps.length).toBeGreaterThan(0));
    const last = capturedProps[capturedProps.length - 1];
    expect(last.theme).not.toBe("light");
  });
});
