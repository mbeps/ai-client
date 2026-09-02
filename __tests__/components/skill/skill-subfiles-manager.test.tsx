import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { SkillSubfilesManager } from "@/components/skill/skill-subfiles-manager";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("SkillSubfilesManager", () => {
  const sampleFiles = [
    { path: "setup.md", content: "# Setup\nInstructions here." },
    { path: "guide.md", content: "# Guide\nDetails here." },
  ];

  it("renders empty state when no files and not adding", () => {
    render(<SkillSubfilesManager files={[]} onSaveFiles={vi.fn()} />);

    expect(screen.getByText("No subfiles yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add first subfile/i }),
    ).toBeInTheDocument();
  });

  it("renders subfiles list minimised by default when files exist", () => {
    render(<SkillSubfilesManager files={sampleFiles} onSaveFiles={vi.fn()} />);

    expect(screen.getByText("setup.md")).toBeInTheDocument();
    expect(screen.getByText("guide.md")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("opens inline draft card when clicking Add Subfile", async () => {
    const user = userEvent.setup();
    render(<SkillSubfilesManager files={sampleFiles} onSaveFiles={vi.fn()} />);

    const addBtn = screen.getByRole("button", { name: /add subfile/i });
    await user.click(addBtn);

    const pathInputs = screen.getAllByPlaceholderText("references/guide.md");
    expect(pathInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("adds new subfile and calls onSaveFiles", async () => {
    const user = userEvent.setup();
    const handleSaveFiles = vi.fn();

    render(
      <SkillSubfilesManager
        files={sampleFiles}
        onSaveFiles={handleSaveFiles}
      />,
    );

    const addBtn = screen.getByRole("button", { name: /add subfile/i });
    await user.click(addBtn);

    const pathInputs = screen.getAllByPlaceholderText("references/guide.md");
    fireEvent.change(pathInputs[0], { target: { value: "types.ts" } });

    const rawTabs = screen.getAllByRole("tab", { name: /raw text/i });
    await user.click(rawTabs[0]);

    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, {
      target: { value: "export type Foo = string;" },
    });

    const saveBtns = screen.getAllByRole("button", { name: /save subfile/i });
    await user.click(saveBtns[0]);

    expect(handleSaveFiles).toHaveBeenCalledWith([
      ...sampleFiles,
      { path: "types.ts", content: "export type Foo = string;" },
    ]);
  });

  it("updates existing subfile after expanding accordion and calls onSaveFiles", async () => {
    const user = userEvent.setup();
    const handleSaveFiles = vi.fn();

    render(
      <SkillSubfilesManager
        files={sampleFiles}
        onSaveFiles={handleSaveFiles}
      />,
    );

    // Expand first accordion
    const trigger = screen.getByRole("button", { name: /setup\.md/i });
    await user.click(trigger);

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "setup-updated.md" } });

    const saveBtn = screen.getByRole("button", { name: /save subfile/i });
    await user.click(saveBtn);

    expect(handleSaveFiles).toHaveBeenCalledWith([
      { path: "setup-updated.md", content: "# Setup\nInstructions here." },
      sampleFiles[1],
    ]);
  });

  it("deletes a subfile after expanding accordion and calls onSaveFiles", async () => {
    const user = userEvent.setup();
    const handleSaveFiles = vi.fn();

    render(
      <SkillSubfilesManager
        files={sampleFiles}
        onSaveFiles={handleSaveFiles}
      />,
    );

    // Expand first accordion
    const trigger = screen.getByRole("button", { name: /setup\.md/i });
    await user.click(trigger);

    const deleteBtn = screen.getByRole("button", { name: /delete subfile/i });
    await user.click(deleteBtn);

    expect(handleSaveFiles).toHaveBeenCalledWith([sampleFiles[1]]);
  });

  it("calls onSaveFiles when clicking Save Changes button", async () => {
    const user = userEvent.setup();
    const handleSaveFiles = vi.fn();

    render(
      <SkillSubfilesManager
        files={sampleFiles}
        onSaveFiles={handleSaveFiles}
      />,
    );

    const saveChangesBtn = screen.getByRole("button", {
      name: /save changes/i,
    });
    await user.click(saveChangesBtn);

    expect(handleSaveFiles).toHaveBeenCalledWith(sampleFiles);
  });
});
