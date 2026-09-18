import { render, screen } from "@testing-library/react";
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
    blocksToMarkdownLossy: vi.fn().mockResolvedValue("Updated text"),
  }),
}));

vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: (props: any) => (
    <div data-testid="blocknote-view" onClick={() => props.onChange?.()}>
      BlockNote Mock
    </div>
  ),
}));

vi.mock("@blocknote/core", () => ({
  BlockNoteEditor: {
    create: () => ({
      tryParseMarkdownToBlocks: vi.fn().mockResolvedValue(mockDocument),
      blocksToMarkdownLossy: vi.fn().mockResolvedValue("Updated text"),
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

import { SkillFileEditor } from "@/components/skill/skill-file-editor";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("SkillFileEditor", () => {
  it("renders SKILL.md with Primary Instructions badge and no delete button", () => {
    render(
      <SkillFileEditor
        filePath="SKILL.md"
        content="# Instructions"
        onChangeContent={vi.fn()}
      />,
    );

    expect(screen.getByText("SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("Primary Instructions")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete file/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /rename/i }),
    ).not.toBeInTheDocument();
  });

  it("renders subfile with Subfile badge, rename, move, and delete buttons", async () => {
    const user = userEvent.setup();
    const handleRename = vi.fn();
    const handleMove = vi.fn();
    const handleDelete = vi.fn();

    render(
      <SkillFileEditor
        filePath="references/guide.md"
        content="# Guide"
        onChangeContent={vi.fn()}
        onRename={handleRename}
        onMove={handleMove}
        onDelete={handleDelete}
      />,
    );

    expect(screen.getByText("references/guide.md")).toBeInTheDocument();
    expect(screen.getByText("Subfile")).toBeInTheDocument();

    const renameBtn = screen.getByRole("button", { name: /rename/i });
    const moveBtn = screen.getByRole("button", { name: /move/i });
    const deleteBtn = screen.getByRole("button", { name: /delete file/i });

    expect(renameBtn).toBeInTheDocument();
    expect(moveBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    await user.click(renameBtn);
    expect(handleRename).toHaveBeenCalledTimes(1);

    await user.click(moveBtn);
    expect(handleMove).toHaveBeenCalledTimes(1);

    await user.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
