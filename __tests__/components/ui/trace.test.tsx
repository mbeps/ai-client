import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

describe("Trace Primitive", () => {
  it("renders basic trace line with icon, title, and description", () => {
    render(
      <Trace>
        <TraceLine>
          <TraceIcon data-testid="test-icon">
            <span>●</span>
          </TraceIcon>
          <TraceTitle>Web Search</TraceTitle>
          <TraceDescription>1.2s</TraceDescription>
        </TraceLine>
      </Trace>,
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.getByText("Web Search")).toBeInTheDocument();
    expect(screen.getByText("1.2s")).toBeInTheDocument();
  });

  it("renders collapsible trace item and toggles content on click", async () => {
    const user = userEvent.setup();

    render(
      <Trace>
        <TraceCollapsible defaultOpen={false}>
          <TraceCollapsibleTrigger>
            <TraceLine status="running">
              <TraceIcon data-testid="tool-icon">
                <span>⚙</span>
              </TraceIcon>
              <TraceTitle>View Payload</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <div>Expanded Payload Body</div>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>,
    );

    const trigger = screen.getByRole("button", { name: /View Payload/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByTestId("tool-icon")).toBeInTheDocument();
    expect(screen.getByText("View Payload").closest("[data-slot=trace-line]")).toHaveAttribute(
      "data-status",
      "running",
    );
    expect(screen.queryByText("Expanded Payload Body")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByText("Expanded Payload Body")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByText("Expanded Payload Body")).not.toBeInTheDocument();
  });
});

