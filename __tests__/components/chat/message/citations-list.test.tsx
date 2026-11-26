import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CitationsList } from "@/components/chat/message/citations-list";

describe("CitationsList", () => {
  it("returns null when citations is empty", () => {
    const { container } = render(<CitationsList citations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("skips malformed citations, groups by documentId, and falls back to Unknown Document", () => {
    render(
      <CitationsList
        citations={[
          { documentId: "", content: "no id" } as any,
          { documentId: "d1", documentName: "Guide.pdf", s3Key: "k1", content: "First snippet" } as any,
          { documentId: "d1", documentName: "Guide.pdf", s3Key: "k1", content: "Second snippet" } as any,
          { documentId: "d2", documentName: "", s3Key: "k2", content: "Unnamed doc" } as any,
        ]}
      />,
    );

    expect(screen.getByText("Guide.pdf")).toBeTruthy();
    expect(screen.getByText("Unknown Document")).toBeTruthy();
  });
});
