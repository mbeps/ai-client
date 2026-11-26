import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentBubble } from "@/components/chat/input/attachment-bubble";

describe("AttachmentBubble", () => {
  it("renders image with dataUrl when vision is supported and handles remove", () => {
    const onRemove = vi.fn();
    render(
      <AttachmentBubble
        attachment={{ id: "att-1", type: "image", name: "photo.png", dataUrl: "data:image/png;base64,abc" } as any}
        supportsVision={true}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByAltText("photo.png")).toBeTruthy();
    expect(screen.queryByText("Unsupported")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledWith("att-1");
  });

  it("renders image without dataUrl and unsupported badge when vision is not supported", () => {
    render(
      <AttachmentBubble
        attachment={{ id: "att-2", type: "image", name: "no-url.png" } as any}
        supportsVision={false}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Unsupported")).toBeTruthy();
    expect(screen.getByText("no-url.png")).toBeTruthy();
  });

  it("renders spreadsheet and document icons", () => {
    const { rerender } = render(
      <AttachmentBubble
        attachment={{ id: "att-3", type: "spreadsheet", name: "data.xlsx" } as any}
        supportsVision={false}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("data.xlsx")).toBeTruthy();

    rerender(
      <AttachmentBubble
        attachment={{ id: "att-4", type: "document", name: "notes.pdf" } as any}
        supportsVision={false}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("notes.pdf")).toBeTruthy();
  });
});
