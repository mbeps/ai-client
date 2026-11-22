import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InternalToolCard } from "@/components/settings/internal-tool-card";

describe("InternalToolCard", () => {
  it("renders display name, technical name, description, availability, and category", () => {
    render(
      <InternalToolCard
        name="search_knowledge_base"
        displayName="Search Knowledge Base"
        description="Searches attached knowledge bases."
        availability="Registered when a knowledge base is attached."
        category="Knowledge"
        approvalMode="auto"
        defaultApproval="auto"
      />,
    );

    expect(screen.getByText("Search Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("search_knowledge_base")).toBeInTheDocument();
    expect(
      screen.getByText("Searches attached knowledge bases."),
    ).toBeInTheDocument();
    expect(screen.getByText("Availability:")).toBeInTheDocument();
    expect(
      screen.getByText("Registered when a knowledge base is attached."),
    ).toBeInTheDocument();
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Auto-approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
  });

  it("falls back to technical name when displayName is omitted", () => {
    render(
      <InternalToolCard
        name="custom_tool"
        description="Custom tool description."
        availability="Always available."
      />,
    );

    expect(screen.getAllByText("custom_tool")).toHaveLength(2);
    expect(screen.getByText("Auto-approved")).toBeInTheDocument();
  });

  it("renders Requires approval when approvalMode is ask and calls onToggleApproval on click", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="create_skill"
        displayName="Create Skill"
        description="Creates a new skill."
        availability="Always registered for tool-calling models."
        category="Skills"
        approvalMode="ask"
        defaultApproval="ask"
        onToggleApproval={onToggleApproval}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /Create Skill approval/i,
    });
    expect(toggle).toHaveTextContent("Requires approval");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(onToggleApproval).toHaveBeenCalledWith("create_skill", "auto");
  });

  it("toggles from auto to ask when clicked", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="save_memory"
        displayName="Save Memory"
        description="Saves long-term memory."
        availability="Registered when selected."
        approvalMode="auto"
        defaultApproval="auto"
        onToggleApproval={onToggleApproval}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /Save Memory approval/i,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(onToggleApproval).toHaveBeenCalledWith("save_memory", "ask");
  });

  it("shows Default label and Reset button when overridden, and resets to default on click", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="create_skill"
        displayName="Create Skill"
        description="Creates a new skill."
        availability="Always registered."
        approvalMode="auto"
        defaultApproval="ask"
        onToggleApproval={onToggleApproval}
      />,
    );

    expect(screen.getByText("Default: Ask")).toBeInTheDocument();
    const resetBtn = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(resetBtn);
    expect(onToggleApproval).toHaveBeenCalledWith("create_skill", "ask");
  });

  it("shows Default: Auto when defaultApproval is auto and overridden to ask", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="save_memory"
        displayName="Save Memory"
        description="Saves memory."
        availability="Registered when selected."
        approvalMode="ask"
        defaultApproval="auto"
        onToggleApproval={onToggleApproval}
      />,
    );

    expect(screen.getByText("Default: Auto")).toBeInTheDocument();
  });

  it("disables toggle and reset buttons when disabled is true", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="create_skill"
        displayName="Create Skill"
        description="Creates a new skill."
        availability="Always registered."
        approvalMode="auto"
        defaultApproval="ask"
        onToggleApproval={onToggleApproval}
        disabled
      />,
    );

    expect(
      screen.getByRole("button", { name: /Create Skill approval/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
  });
});
