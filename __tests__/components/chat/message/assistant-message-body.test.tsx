import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssistantMessageBody } from "@/components/chat/message/assistant-message-body";
import { downloadArtifact } from "@/lib/artifacts/download-artifact";
import type { ArtifactData } from "@/types/artifact/artifact-data";

vi.mock("@/lib/artifacts/download-artifact", () => ({
  downloadArtifact: vi.fn(),
}));

vi.mock("@/components/chat/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

describe("AssistantMessageBody", () => {
  it("calls downloadArtifact when CanvasCard download button is clicked", () => {
    const artifact = {
      id: "a1",
      title: "My Doc",
      type: "markdown",
      content: "# Hi",
    } as unknown as ArtifactData;

    render(
      <AssistantMessageBody
        content="Hello"
        isStreaming={false}
        messageArtifacts={[artifact]}
        messageDownloads={[]}
        isCanvasOpen={false}
        activeArtifactId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download My Doc" }));
    expect(downloadArtifact).toHaveBeenCalledWith(artifact);
  });
});
