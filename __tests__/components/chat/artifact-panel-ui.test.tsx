import { act, fireEvent, render, screen } from "@testing-library/react";
import { type MutableRefObject, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { MarkdownViewFlushFn } from "@/components/chat/artifacts/markdown-view";

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

const mockDownloadArtifact = vi.hoisted(() => vi.fn());
const uiViewMountCounter = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
const pendingMarkdownRef = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("katex/dist/katex.min.css", () => ({}));

vi.mock("@/lib/artifacts/download-artifact", () => ({
  downloadArtifact: mockDownloadArtifact,
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    void loader().catch(() => {});
    const src = loader.toString();
    if (src.includes("ui-view")) {
      return function MockUiView({ content }: { content: string }) {
        useEffect(() => {
          uiViewMountCounter.mounts += 1;
          return () => {
            uiViewMountCounter.unmounts += 1;
          };
        }, []);
        return <div data-testid="ui-view">{content}</div>;
      };
    }
    if (src.includes("markdown-view")) {
      return function MockMarkdownView({
        content,
        onUpdate,
        flushRef,
      }: {
        content: string;
        onUpdate?: (c: string) => void;
        flushRef?: MutableRefObject<MarkdownViewFlushFn | null>;
      }) {
        useEffect(() => {
          if (!flushRef) return;
          flushRef.current = () => {
            if (pendingMarkdownRef.value === null) return null;
            const next = pendingMarkdownRef.value;
            pendingMarkdownRef.value = null;
            return Promise.resolve().then(() => {
              onUpdate?.(next);
            });
          };
          return () => {
            flushRef.current = null;
          };
        }, [flushRef, onUpdate]);
        return <div data-testid="markdown-view">{content}</div>;
      };
    }
    if (src.includes("spreadsheet-view")) {
      return function MockSpreadsheetView({ content }: { content: string }) {
        return <div data-testid="spreadsheet-view">{content}</div>;
      };
    }
    return function MockHtmlView({ content }: { content: string }) {
      return <div data-testid="html-view">{content}</div>;
    };
  },
}));

vi.mock("@/components/chat/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

import { ArtifactPanel } from "@/components/chat/artifact-panel";

describe("ArtifactPanel — Interactive UI & Markdown Preview/Edit", () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    uiViewMountCounter.mounts = 0;
    uiViewMountCounter.unmounts = 0;
    pendingMarkdownRef.value = null;
    writeTextMock.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  it("renders UiView for type 'ui', copies JSON spec with toast.info, and triggers download", async () => {
    const uiArtifact: ArtifactData = {
      id: "art-ui-1",
      messageId: "msg-1",
      type: "ui",
      title: "Sales Dashboard",
      content: '{"root":"card","elements":{}}',
    };

    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={uiArtifact}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[uiArtifact]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("ui-view")).toHaveTextContent(
      '{"root":"card","elements":{}}',
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy content" }));
    });

    expect(writeTextMock).toHaveBeenCalledWith(uiArtifact.content);
    expect(mockToast.info).toHaveBeenCalledWith(
      "Copied UI spec JSON — rendered UI cannot be copied directly",
    );
    expect(mockToast.success).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Download file" }));
    expect(mockDownloadArtifact).toHaveBeenCalledWith(uiArtifact);
  });

  it("defaults to Preview for markdown with UI blocks and allows toggling to Edit", () => {
    const mdWithUi: ArtifactData = {
      id: "art-md-ui",
      messageId: "msg-1",
      type: "markdown",
      title: "Interactive Report",
      content: "# Summary\n\n```spec\n{\"root\":\"c\",\"elements\":{}}\n```",
    };

    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={mdWithUi}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[mdWithUi]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    const previewBtn = screen.getByRole("button", { name: "Preview" });
    const editBtn = screen.getByRole("button", { name: "Edit" });
    expect(previewBtn).toBeInTheDocument();
    expect(editBtn).toBeInTheDocument();
    expect(screen.getByTestId("markdown-renderer")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-view")).toBeNull();

    fireEvent.click(editBtn);
    expect(screen.getByTestId("markdown-view")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-renderer")).toBeNull();

    fireEvent.click(previewBtn);
    expect(screen.getByTestId("markdown-renderer")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-view")).toBeNull();
  });

  it("opens straight to MarkdownView with no Preview/Edit toggle for plain markdown", () => {
    const plainMd: ArtifactData = {
      id: "art-md-plain",
      messageId: "msg-1",
      type: "markdown",
      title: "Plain Doc",
      content: "# Just text\n\nNo UI blocks here.",
    };

    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={plainMd}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[plainMd]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("markdown-view")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("strips UI blocks and shows toast.info when copying markdown containing UI blocks", async () => {
    const mdWithUi: ArtifactData = {
      id: "art-md-ui-copy",
      messageId: "msg-1",
      type: "markdown",
      title: "Interactive Report",
      content:
        "Intro text\n\n```spec\n{\"root\":\"c\",\"elements\":{}}\n```\n\nOutro text",
    };

    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={mdWithUi}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[mdWithUi]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy content" }));
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "Intro text\n\n[Interactive UI omitted]\n\nOutro text",
    );
    expect(mockToast.info).toHaveBeenCalledWith(
      "Copied text — interactive UI blocks were omitted",
    );
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("copies plain markdown with toast.success and handles clipboard errors", async () => {
    const plainMd: ArtifactData = {
      id: "art-md-plain-copy",
      messageId: "msg-1",
      type: "markdown",
      title: "Plain Doc",
      content: "# Hello",
    };

    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={plainMd}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[plainMd]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy content" }));
    });

    expect(writeTextMock).toHaveBeenCalledWith("# Hello");
    expect(mockToast.success).toHaveBeenCalledWith("Copied to clipboard");

    writeTextMock.mockRejectedValueOnce(new Error("Clipboard denied"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy content" }));
    });
    expect(mockToast.error).toHaveBeenCalledWith("Failed to copy content");
  });

  it("resets markdownMode to preview when switching to a different artifact", () => {
    const firstMd: ArtifactData = {
      id: "art-md-1",
      messageId: "msg-1",
      type: "markdown",
      title: "First Report",
      content: "# One\n\n```spec\n{\"root\":\"c\",\"elements\":{}}\n```",
    };
    const secondMd: ArtifactData = {
      id: "art-md-2",
      messageId: "msg-2",
      type: "markdown",
      title: "Second Report",
      content: "# Two\n\n```spec\n{\"root\":\"d\",\"elements\":{}}\n```",
    };

    const { rerender } = render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={firstMd}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[firstMd]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("markdown-view")).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <ArtifactPanel
          artifact={secondMd}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[secondMd]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("markdown-renderer")).toBeInTheDocument();
  });

  it("flushes pending MarkdownView edits before switching to Preview", async () => {
    const initialContent = "# Draft\n\n```spec\n{\"root\":\"c\",\"elements\":{}}\n```";
    const editedContent = "# Edited Draft\n\n```spec\n{\"root\":\"c\",\"elements\":{}}\n```";

    function StatefulPanelHarness() {
      const [content, setContent] = useState(initialContent);
      const artifact: ArtifactData = {
        id: "art-md-flush",
        messageId: "msg-1",
        type: "markdown",
        title: "Flushable",
        content,
      };
      return (
        <TooltipProvider>
          <ArtifactPanel
            artifact={artifact}
            isOpen={true}
            onClose={vi.fn()}
            artifacts={[artifact]}
            currentIndex={0}
            onUpdate={setContent}
          />
        </TooltipProvider>
      );
    }

    render(<StatefulPanelHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("markdown-view")).toBeInTheDocument();

    pendingMarkdownRef.value = editedContent;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    });

    expect(screen.getByTestId("markdown-renderer")).toHaveTextContent(
      "# Edited Draft",
    );
  });

  it("remounts UiView when switching to a different UI artifact", () => {
    const firstUi: ArtifactData = {
      id: "art-ui-1",
      messageId: "msg-1",
      type: "ui",
      title: "First UI",
      content: '{"root":"a","elements":{}}',
    };
    const secondUi: ArtifactData = {
      id: "art-ui-2",
      messageId: "msg-2",
      type: "ui",
      title: "Second UI",
      content: '{"root":"b","elements":{}}',
    };

    const { rerender } = render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={firstUi}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[firstUi, secondUi]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    expect(uiViewMountCounter.mounts).toBe(1);
    expect(uiViewMountCounter.unmounts).toBe(0);

    rerender(
      <TooltipProvider>
        <ArtifactPanel
          artifact={secondUi}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[firstUi, secondUi]}
          currentIndex={1}
        />
      </TooltipProvider>,
    );

    expect(uiViewMountCounter.mounts).toBe(2);
    expect(uiViewMountCounter.unmounts).toBe(1);
  });
});
