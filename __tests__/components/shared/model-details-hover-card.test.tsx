import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelDetailsHoverCard } from "@/components/shared/model-details-hover-card";

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ModelDetailsHoverCard", () => {
  it("renders with all capabilities and without capabilities", () => {
    const { rerender } = render(
      <ModelDetailsHoverCard
        open
        model={{
          label: "GPT-4o",
          modelId: "gpt-4o",
          providerName: "OpenAI",
          contextWindow: 128000,
          capTools: true,
          capVision: true,
          capReasoning: true,
          capStructuredOutput: true,
        }}
      >
        <span>Trigger</span>
      </ModelDetailsHoverCard>,
    );

    expect(screen.getByText("tools")).toBeInTheDocument();
    expect(screen.getByText("vision")).toBeInTheDocument();
    expect(screen.getByText("reasoning")).toBeInTheDocument();
    expect(screen.getByText("structured output")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();

    rerender(
      <ModelDetailsHoverCard
        open
        model={{
          label: "Basic",
          modelId: "basic",
          providerName: "Local",
          contextWindow: 0,
          capTools: false,
          capVision: false,
          capReasoning: false,
          capStructuredOutput: false,
        }}
      >
        <span>Trigger</span>
      </ModelDetailsHoverCard>,
    );

    expect(screen.queryByText("Capabilities")).not.toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
  });

  it("renders partial capabilities (only capTools or only capVision)", () => {
    const { rerender } = render(
      <ModelDetailsHoverCard
        model={{
          modelId: "m-tools",
          label: "Tools Only",
          providerName: "OpenAI",
          contextWindow: 4096,
          capTools: true,
          capVision: false,
          capReasoning: false,
          capStructuredOutput: false,
          reasoningEffortFormat: null,
        }}
        open
      >
        <span>Trigger</span>
      </ModelDetailsHoverCard>,
    );
    expect(screen.getByText("tools")).toBeInTheDocument();
    expect(screen.queryByText("vision")).not.toBeInTheDocument();

    rerender(
      <ModelDetailsHoverCard
        model={{
          modelId: "m-vis",
          label: "Vision Only",
          providerName: "OpenAI",
          contextWindow: 4096,
          capTools: false,
          capVision: true,
          capReasoning: false,
          capStructuredOutput: false,
          reasoningEffortFormat: null,
        }}
        open
      >
        <span>Trigger</span>
      </ModelDetailsHoverCard>,
    );
    expect(screen.getByText("vision")).toBeInTheDocument();
  });
  it("renders partial capabilities (only capTools or only capVision)", () => {
    const { rerender } = render(
      <ModelDetailsHoverCard
        model={{
          modelId: "m-tools",
          label: "Tools Only",
          providerName: "OpenAI",
          contextWindow: 4096,
          capTools: true,
          capVision: false,
          capReasoning: false,
          capStructuredOutput: false,
          reasoningEffortFormat: null,
        }}
        open
      >
        <span>Trigger</span>
      </ModelDetailsHoverCard>,
    );
    expect(screen.getByText("tools")).toBeInTheDocument();
    expect(screen.queryByText("vision")).not.toBeInTheDocument();

    rerender(
      <ModelDetailsHoverCard
        model={{
          modelId: "m-vis",
          label: "Vision Only",
          providerName: "OpenAI",
          contextWindow: 4096,
          capTools: false,
          capVision: true,
          capReasoning: false,
          capStructuredOutput: false,
          reasoningEffortFormat: null,
        }}
        open
      >
        <span>Trigger</span>
      </ModelDetailsHoverCard>,
    );
    expect(screen.getByText("vision")).toBeInTheDocument();
  });
});
