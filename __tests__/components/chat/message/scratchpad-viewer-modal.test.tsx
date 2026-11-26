import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getScratchpadFilesAction } from "@/actions/subagents/get-scratchpad";
import { ScratchpadViewerModal } from "@/components/chat/message/scratchpad-viewer-modal";

vi.mock("@/actions/subagents/get-scratchpad", () => ({
  getScratchpadFilesAction: vi.fn().mockResolvedValue({
    ok: true,
    value: [
      {
        id: "f-1",
        filePath: "notes/findings.md",
        content: "# Research Findings\nDetails here.",
        writtenByRole: "researcher",
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "f-2",
        filePath: "specs/architecture.json",
        content: '{\n  "version": "1.0"\n}',
        writtenByRole: "planner",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ScratchpadViewerModal", () => {
  it("fetches and renders files when opened", async () => {
    render(
      <ScratchpadViewerModal messageId="msg-456" open={true} />,
    );

    expect(getScratchpadFilesAction).toHaveBeenCalledWith("msg-456");

    await waitFor(() => {
      expect(screen.getAllByText("notes/findings.md").length).toBeGreaterThan(0);
      expect(screen.getByText("specs/architecture.json")).toBeDefined();
      expect(screen.getByText("Research Findings")).toBeDefined();
    });
  });

  it("switches active file preview when another file is clicked", async () => {
    render(
      <ScratchpadViewerModal messageId="msg-456" open={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText("specs/architecture.json")).toBeDefined();
    });

    const secondFileButton = screen.getByText("specs/architecture.json");
    fireEvent.click(secondFileButton);

    await waitFor(() => {
      expect(screen.getByText(/"version": "1.0"/)).toBeDefined();
    });
  });

  it("copies content to clipboard when copy button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ScratchpadViewerModal messageId="msg-456" open={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeDefined();
    });

    const copyBtn = screen.getByText("Copy");
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      "# Research Findings\nDetails here.",
    );
  });

  it("calls getScratchpadFilesAction with chatId and messageId when chatId is provided", async () => {
    render(
      <ScratchpadViewerModal chatId="chat-999" messageId="msg-456" open={true} />,
    );

    expect(getScratchpadFilesAction).toHaveBeenCalledWith("chat-999", "msg-456");
  });

  it("handles streaming messageId safely without calling action", async () => {
    vi.mocked(getScratchpadFilesAction).mockClear();
    render(
      <ScratchpadViewerModal chatId="chat-999" messageId="streaming" open={true} />,
    );

    expect(getScratchpadFilesAction).not.toHaveBeenCalled();
    expect(screen.getByText("No scratchpad files recorded for this turn.")).toBeDefined();
  });

  it("handles trigger open/close, error responses, empty files, refresh preserving selection, and clipboard failure", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(getScratchpadFilesAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "Forbidden" },
    } as any);

    render(
      <ScratchpadViewerModal
        messageId="msg-err"
        trigger={<button type="button">Open Scratchpad</button>}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByText("Open Scratchpad"));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(screen.getByText("Forbidden")).toBeDefined();
    });

    // Empty files
    vi.mocked(getScratchpadFilesAction).mockResolvedValueOnce({
      ok: true,
      value: [],
    } as any);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(screen.getByText("No scratchpad files recorded for this turn.")).toBeDefined();
    });

    // Non-Error throw
    vi.mocked(getScratchpadFilesAction).mockRejectedValueOnce("boom");
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(screen.getByText("Failed to load scratchpad files")).toBeDefined();
    });

    // 1 file + clipboard failure
    vi.mocked(getScratchpadFilesAction).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "f1", filePath: "a.md", writtenByRole: "coder", version: 1, content: "hi" }],
    } as any);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(screen.getByText("1 file")).toBeDefined();
    });

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValueOnce(new Error("denied")) },
    });
    fireEvent.click(screen.getByText("Copy"));
  });

  it("handles empty error message, non-Error throw, and copy timeout reset", async () => {
    const { getScratchpadFilesAction } = await import("@/actions/subagents/get-scratchpad");
    vi.mocked(getScratchpadFilesAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    } as any);

    render(<ScratchpadViewerModal chatId="c1" messageId="m1" open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load scratchpad files")).toBeDefined();
    });

    vi.mocked(getScratchpadFilesAction).mockRejectedValueOnce("non-error");
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(screen.getByText("Failed to load scratchpad files")).toBeDefined();
    });

    vi.mocked(getScratchpadFilesAction).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "f1", filePath: "a.md", writtenByRole: "coder", version: 1, content: "hi" }],
    } as any);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeDefined();
    });

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) },
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeDefined();
    });
    vi.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeDefined();
    });
    vi.useRealTimers();
  });

  it("handles non-Error rejection and preserves selectedFileId on re-open", async () => {
    vi.mocked(getScratchpadFilesAction).mockRejectedValueOnce("network error");
    const { rerender } = render(
      <ScratchpadViewerModal
        open={true}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Failed to load scratchpad files")).toBeDefined();
    });

    vi.mocked(getScratchpadFilesAction).mockResolvedValue({
      ok: true,
      value: [
        { id: "f1", filePath: "a.ts", content: "const a = 1;", size: 12 },
        { id: "f2", filePath: "b.ts", content: "const b = 2;", size: 12 },
      ] as never,
    });
    rerender(
      <ScratchpadViewerModal
        open={false}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    rerender(
      <ScratchpadViewerModal
        open={true}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    await waitFor(() => {
      expect(screen.getAllByText("a.ts").length).toBeGreaterThan(0);
    });

    rerender(
      <ScratchpadViewerModal
        open={false}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    rerender(
      <ScratchpadViewerModal
        open={true}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    await waitFor(() => {
      expect(screen.getAllByText("a.ts").length).toBeGreaterThan(0);
    });
  });

  it("handles Error rejection and no-op copy when activeFile is undefined", async () => {
    vi.mocked(getScratchpadFilesAction).mockRejectedValueOnce(new Error("boom"));
    const { rerender } = render(
      <ScratchpadViewerModal
        open={true}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("boom")).toBeDefined();
    });

    vi.mocked(getScratchpadFilesAction).mockResolvedValueOnce({
      ok: true,
      value: [],
    });
    rerender(
      <ScratchpadViewerModal
        open={false}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    rerender(
      <ScratchpadViewerModal
        open={true}
        onOpenChange={vi.fn()}
        chatId="c1"
        messageId="m1"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("No scratchpad files recorded for this turn.")).toBeDefined();
    });
  });
});
