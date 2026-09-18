import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("katex/dist/katex.min.css", () => ({}));

import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ArtifactData } from "@/types/artifact/artifact-data";

const mockArtifact: ArtifactData = {
  id: "art-1",
  messageId: "msg-1",
  type: "markdown",
  title: "Test Plan",
  content: "# Hello world",
};

describe("ArtifactPanel", () => {
  it("renders action buttons with aria-labels and no native title attributes", () => {
    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={mockArtifact}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[mockArtifact]}
          currentIndex={0}
        />
      </TooltipProvider>,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy content" });
    const downloadBtn = screen.getByRole("button", { name: "Download file" });
    const closeBtn = screen.getByRole("button", { name: "Close artifact" });

    expect(copyBtn).toBeInTheDocument();
    expect(downloadBtn).toBeInTheDocument();
    expect(closeBtn).toBeInTheDocument();

    expect(copyBtn.getAttribute("title")).toBeNull();
    expect(downloadBtn.getAttribute("title")).toBeNull();
    expect(closeBtn.getAttribute("title")).toBeNull();
  });

  it("renders navigation buttons when multiple artifacts are provided", () => {
    const secondArtifact: ArtifactData = {
      ...mockArtifact,
      id: "art-2",
      title: "Second Artifact",
    };

    render(
      <TooltipProvider>
        <ArtifactPanel
          artifact={mockArtifact}
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[mockArtifact, secondArtifact]}
          currentIndex={0}
          onNavigate={vi.fn()}
        />
      </TooltipProvider>,
    );

    const prevBtn = screen.getByRole("button", { name: "Previous artifact" });
    const nextBtn = screen.getByRole("button", { name: "Next artifact" });

    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    expect(prevBtn.getAttribute("title")).toBeNull();
    expect(nextBtn.getAttribute("title")).toBeNull();
  });
});
