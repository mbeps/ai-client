import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ArtifactData } from "@/types/artifact/artifact-data";

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

const mockDownloadArtifact = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("katex/dist/katex.min.css", () => ({}));

vi.mock("@/lib/artifacts/download-artifact", () => ({
  downloadArtifact: mockDownloadArtifact,
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    const src = loader.toString();
    if (src.includes("ui-view")) {
      return function MockUiView({ content }: { content: string }) {
        return <div data-testid="ui-view">{content}</div>;
      };
    }
    if (src.includes("markdown-view")) {
      return function MockMarkdownView({ content }: { content: string }) {
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
});
