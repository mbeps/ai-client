import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("renders in view mode by default with file path and rendered markdown", () => {
    render(
      <SkillSubfileCard
        file={sampleFile}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("setup.md")).toBeInTheDocument();
    expect(screen.getByText("Setup instructions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit subfile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete subfile/i }),
    ).toBeInTheDocument();
  });

  it("switches to edit view when clicking the edit button", async () => {
    const user = userEvent.setup();
    render(
      <SkillSubfileCard
        file={sampleFile}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const editBtn = screen.getByRole("button", { name: /edit subfile/i });
    await user.click(editBtn);

    // Should now show input with file path and MarkdownTabEditor tabs
    expect(screen.getByDisplayValue("setup.md")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view preview/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("saves changes and returns to view mode when clicking Save", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        onSave={handleSave}
        onDelete={vi.fn()}
        initialMode="edit"
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

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await user.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith({
      path: "references/setup-guide.md",
      content: "## New Setup Content",
    });

    // Returns to view mode
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /edit subfile/i }),
      ).toBeInTheDocument();
    });
  });

  it("reverts changes and switches back to view mode on Cancel", async () => {
    const user = userEvent.setup();
    render(
      <SkillSubfileCard
        file={sampleFile}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        initialMode="edit"
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "modified.md" } });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(
      screen.getByRole("button", { name: /edit subfile/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("setup.md")).toBeInTheDocument();
  });

  it("validates empty file path and prevents saving", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <SkillSubfileCard
        file={sampleFile}
        onSave={handleSave}
        onDelete={vi.fn()}
        initialMode="edit"
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "   " } });

    const saveBtn = screen.getByRole("button", { name: /save/i });
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
        onSave={handleSave}
        onDelete={vi.fn()}
        initialMode="edit"
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "SKILL.md" } });

    const saveBtn = screen.getByRole("button", { name: /save/i });
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
        onSave={handleSave}
        onDelete={vi.fn()}
        existingPaths={["other.md", "setup.md", "references/guide.md"]}
        initialMode="edit"
      />,
    );

    const pathInput = screen.getByDisplayValue("setup.md");
    fireEvent.change(pathInput, { target: { value: "references/guide.md" } });

    const saveBtn = screen.getByRole("button", { name: /save/i });
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
        onSave={vi.fn()}
        onDelete={vi.fn()}
        initialMode="edit"
        onCancelNew={handleCancelNew}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(handleCancelNew).toHaveBeenCalledOnce();
  });
});
