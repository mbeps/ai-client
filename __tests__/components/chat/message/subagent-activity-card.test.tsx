import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubagentActivityCard } from "@/components/chat/message/subagent-activity-card";

vi.mock("@/actions/subagents/get-scratchpad", () => ({
  getScratchpadFilesAction: vi.fn().mockResolvedValue([
    {
      id: "f-1",
      filePath: "analysis/market.md",
      content: "# Market Analysis\nGrowth is strong.",
      writtenByRole: "researcher",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
}));

describe("SubagentActivityCard", () => {
  it("renders role, brief, and running status when pending", () => {
    render(
      <SubagentActivityCard
        role="researcher"
        taskBrief="Analyze market trends for Q3"
        status="pending"
      />,
    );

    expect(screen.getByText("Researcher")).toBeDefined();
    expect(screen.getByText(/Analyze market trends/)).toBeDefined();
    expect(screen.getByText("Delegating...")).toBeDefined();
  });

  it("renders completed status and output text when completed", () => {
    render(
      <SubagentActivityCard
        role="planner"
        taskBrief="Create implementation roadmap"
        status="complete"
        result={{
          value: "STATUS: DONE\nRoadmap complete with 4 phases.",
        }}
        initialOpen={true}
      />,
    );

    expect(screen.getByText("Planner")).toBeDefined();
    expect(screen.getByText("Completed")).toBeDefined();
    expect(
      screen.getByText(/Roadmap complete with 4 phases/),
    ).toBeDefined();
  });

  it("renders concerns badge when status is DONE_WITH_CONCERNS", () => {
    render(
      <SubagentActivityCard
        role="reviewer"
        taskBrief="Review code security"
        status="complete"
        result="STATUS: DONE_WITH_CONCERNS\nFound potential timeout risk."
      />,
    );

    expect(screen.getByText("Reviewer")).toBeDefined();
    expect(screen.getByText("Concerns")).toBeDefined();
  });

  it("renders blocked badge when status is BLOCKED", () => {
    render(
      <SubagentActivityCard
        role="worker"
        taskBrief="Execute migration"
        status="error"
        result="STATUS: BLOCKED\nMissing permissions."
      />,
    );

    expect(screen.getByText("Blocked")).toBeDefined();
  });

  it("renders scratchpad button when messageId is provided", () => {
    render(
      <SubagentActivityCard
        role="researcher"
        taskBrief="Deep research"
        status="complete"
        messageId="msg-123"
      />,
    );

    const button = screen.getByText("Scratchpad");
    expect(button).toBeDefined();
    fireEvent.click(button);

    // Modal title should open
    expect(screen.getByText("Subagent Scratchpad Files")).toBeDefined();
  });
});

