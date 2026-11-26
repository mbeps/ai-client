import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MessageActions } from "@/components/chat/message/message-actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/types/chat";

describe("MessageActions", () => {
  it("shows 'No models configured' tooltip when hasNoModels is true", () => {
    render(
      <TooltipProvider>
        <MessageActions
          message={{ id: "m1", role: "assistant", parts: [] } as unknown as ChatMessage}
          isUser={false}
          siblings={[]}
          currentSiblingIndex={0}
          isLoading={false}
          hasNoModels={true}
          copied={false}
          onCopy={vi.fn()}
          onRegenerate={vi.fn()}
          onNavigate={vi.fn()}
        />
      </TooltipProvider>,
    );

    const regenBtn = screen.getByRole("button", { name: "Regenerate response" });
    expect((regenBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.focus(regenBtn);
    fireEvent.mouseEnter(regenBtn);
  });

  it("handles missing sibling ids when navigating branches", () => {
    const onNavigate = vi.fn();
    render(
      <TooltipProvider>
        <MessageActions
          message={{ id: "m2", role: "assistant", content: "hi" } as never}
          isUser={false}
          isLoading={false}
          siblings={[{ id: "" }, { id: "m2" }, { id: "" }] as never}
          currentSiblingIndex={1}
          onNavigate={onNavigate}
          onRegenerate={vi.fn()}
        />
      </TooltipProvider>,
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
