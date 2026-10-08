import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getScratchpadFilesAction } from "@/actions/subagents/get-scratchpad";
import { ScratchpadViewerModal } from "@/components/chat/message/scratchpad-viewer-modal";

vi.mock("@/actions/subagents/get-scratchpad", () => ({
  getScratchpadFilesAction: vi.fn().mockResolvedValue([
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
  ]),
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
      expect(screen.getByText(/# Research Findings/)).toBeDefined();
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
});
