import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ReasoningTraceStep } from "@/components/chat/message/reasoning-trace-step";

describe("ReasoningTraceStep", () => {
  it("starts open when running is true, then automatically collapses when finished", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReasoningTraceStep text="Active thoughts in progress" running={true} />,
    );

    // Running state: title is "Thinking...", content is rendered
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByText("Active thoughts in progress")).toBeInTheDocument();

    // Re-render with running = false (thinking finished)
    rerender(
      <ReasoningTraceStep text="Active thoughts in progress" running={false} />,
    );

    // Title changes to "Thought process"
    expect(screen.getByText("Thought process")).toBeInTheDocument();
    // Content is now collapsed / unmounted by Collapsible
    expect(
      screen.queryByText("Active thoughts in progress"),
    ).not.toBeInTheDocument();

    // User can manually expand it again
    const trigger = screen.getByRole("button", { name: /thought process/i });
    await user.click(trigger);
    expect(
      await screen.findByText("Active thoughts in progress"),
    ).toBeInTheDocument();
  });

  it("starts collapsed when running is false initially", async () => {
    const user = userEvent.setup();
    render(
      <ReasoningTraceStep text="Persisted thought process" running={false} />,
    );

    expect(screen.getByText("Thought process")).toBeInTheDocument();
    expect(
      screen.queryByText("Persisted thought process"),
    ).not.toBeInTheDocument();

    // Expand on click
    const trigger = screen.getByRole("button", { name: /thought process/i });
    await user.click(trigger);
    expect(
      await screen.findByText("Persisted thought process"),
    ).toBeInTheDocument();
  });
});
