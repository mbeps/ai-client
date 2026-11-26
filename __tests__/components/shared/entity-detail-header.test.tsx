import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityDetailHeader } from "@/components/shared/entity-detail-header";

describe("EntityDetailHeader", () => {
  it("renders title, description, custom action, and fallback action button", () => {
    const onAction = vi.fn();
    const { rerender } = render(
      <EntityDetailHeader
        icon={<span data-testid="hdr-icon" />}
        title="My Agent"
        description="Agent desc"
        action={<button type="button">Custom</button>}
      />,
    );

    expect(screen.getByText("My Agent")).toBeInTheDocument();
    expect(screen.getByText("Agent desc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();

    rerender(
      <EntityDetailHeader
        icon={<span data-testid="hdr-icon" />}
        title="My Project"
        actionLabel="New Chat"
        actionIcon={<span data-testid="act-icon" />}
        onAction={onAction}
      />,
    );

    const btn = screen.getByRole("button", { name: "New Chat" });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("act-icon")).toBeInTheDocument();

    rerender(
      <EntityDetailHeader icon={<span />} title="No Action" />,
    );
    expect(screen.getByText("No Action")).toBeInTheDocument();
  });
});
