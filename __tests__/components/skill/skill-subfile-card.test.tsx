import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

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

import { SkillSubfileCard } from "@/components/skill/skill-subfile-card";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("SkillSubfileCard", () => {
  const sampleFile = {
    path: "setup.md",
    content: "# Setup instructions\nRun npm install.",
  };

  it("is minimised by default and expands when clicking anywhere on the accordion header", async () => {
    const user = userEvent.setup();
    render(
      <SkillSubfileCard
        file={sampleFile}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Header label visible
    const trigger = screen.getByRole("button", { name: /setup\.md/i });
    expect(trigger).toBeInTheDocument();

    // Click anywhere on trigger to expand
    await user.click(trigger);

    // Direct editing view fields visible
    expect(screen.getByDisplayValue("setup.md")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete subfile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save subfile/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /rich text/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /raw text/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preview/i })).toBeInTheDocument();
  });

  it("saves changes when clicking Save", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        defaultOpen={true}
        onSave={handleSave}
        onDelete={vi.fn()}
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, {
      target: { value: "references/setup-guide.md" },
    });

    const rawTab = screen.getByRole("tab", { name: /raw text/i });
    await user.click(rawTab);

    const textarea = document.querySelector("textarea")!;
    expect(textarea).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: "## New Setup Content" } });

    const saveBtn = screen.getByRole("button", { name: /save subfile/i });
    await user.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith({
      path: "references/setup-guide.md",
      content: "## New Setup Content",
    });
  });

  it("reverts changes on Reset", async () => {
    const user = userEvent.setup();
    render(
      <SkillSubfileCard
        file={sampleFile}
        defaultOpen={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "modified.md" } });
    expect(screen.getByDisplayValue("modified.md")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /reset/i });
    await user.click(resetBtn);

    expect(screen.getByDisplayValue("setup.md")).toBeInTheDocument();
  });

  it("validates empty file path and prevents saving", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        defaultOpen={true}
        onSave={handleSave}
        onDelete={vi.fn()}
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "   " } });

    const saveBtn = screen.getByRole("button", { name: /save subfile/i });
    await user.click(saveBtn);

    expect(toast.error).toHaveBeenCalledWith(
      "File path is required (e.g. references/guide.md)",
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("prevents saving with reserved skill.md path", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        defaultOpen={true}
        onSave={handleSave}
        onDelete={vi.fn()}
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "SKILL.md" } });

    const saveBtn = screen.getByRole("button", { name: /save subfile/i });
    await user.click(saveBtn);

    expect(toast.error).toHaveBeenCalledWith(
      "SKILL.md is the main instruction file. Edit it in the General tab.",
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("prevents duplicate file paths", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        defaultOpen={true}
        onSave={handleSave}
        onDelete={vi.fn()}
        existingPaths={["other.md", "setup.md", "references/guide.md"]}
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "references/guide.md" } });

    const saveBtn = screen.getByRole("button", { name: /save subfile/i });
    await user.click(saveBtn);

    expect(toast.error).toHaveBeenCalledWith(
      'A subfile with path "references/guide.md" already exists.',
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("calls onDelete callback when delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        defaultOpen={true}
        onSave={vi.fn()}
        onDelete={handleDelete}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /delete subfile/i });
    await user.click(deleteBtn);

    expect(handleDelete).toHaveBeenCalledOnce();
  });

  it("calls onCancelNew when cancelling a new draft subfile", async () => {
    const user = userEvent.setup();
    const handleCancelNew = vi.fn();

    render(
      <SkillSubfileCard
        file={{ path: "", content: "" }}
        defaultOpen={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onCancelNew={handleCancelNew}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(handleCancelNew).toHaveBeenCalledOnce();
  });
});
