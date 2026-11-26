import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompactionDivider } from "@/components/chat/message/compaction-divider";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("CompactionDivider", () => {
  it("renders compaction metadata badges, toggles summary, and calls onDelete", () => {
    const onDelete = vi.fn();
    render(
      <TooltipProvider>
        <CompactionDivider
          message={{
            id: "msg-c1",
            role: "system",
            content: "Summary of compacted conversation",
            metadata: JSON.stringify({
              compaction: { compactedCount: 12, auto: true },
            }),
          } as any}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Conversation compacted")).toBeTruthy();
    expect(screen.getByText("12 messages")).toBeTruthy();
    expect(screen.getByText("Auto")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /View summary/i }));
    expect(screen.getByRole("button", { name: /Hide summary/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete compaction checkpoint" }));
    expect(onDelete).toHaveBeenCalledWith("msg-c1");
  });

  it("renders without optional badges or delete button when metadata and onDelete are absent", () => {
    render(
      <TooltipProvider>
        <CompactionDivider
          message={{
            id: "msg-c2",
            role: "system",
            content: "Minimal summary",
            metadata: null,
          } as any}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Conversation compacted")).toBeTruthy();
    expect(screen.queryByText(/messages/)).toBeNull();
    expect(screen.queryByText("Auto")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete compaction checkpoint" })).toBeNull();
  });
});
